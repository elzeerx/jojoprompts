// Admin-only signed upload path for private resource packages
// (skills, automations). Two actions:
//   { action: "create_upload", resource_id, filename, size_bytes, content_type, checksum_sha256 }
//     → returns { bucket, path, token } (signed upload URL token; PUT via storage endpoint)
//   { action: "finalize_upload", resource_id, path, size_bytes, checksum_sha256, content_type, filename }
//     → registers the file on the CURRENT resource_version_id and enqueues a scan
//       (creates a package_scans row with status='pending'); publishing remains blocked until clean.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "resource-packages";
const MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const ALLOWED_CONTENT = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "application/json",
  "text/plain",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is an admin via JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing bearer token" }, 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: hasAdmin } = await admin.rpc("has_role", {
      _user_id: userRes.user.id,
      _role: "admin",
    });
    if (!hasAdmin) return json({ error: "Admin role required" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const resourceId = String(body?.resource_id ?? "");
    if (!resourceId) return json({ error: "resource_id required" }, 400);

    // Confirm resource exists and is skill/automation.
    const { data: resource, error: rErr } = await admin
      .from("resources")
      .select("id, type, current_version_id, lifecycle")
      .eq("id", resourceId)
      .maybeSingle();
    if (rErr || !resource) return json({ error: "resource not found" }, 404);
    if (resource.type !== "skill" && resource.type !== "automation") {
      return json({ error: "package uploads apply only to skill and automation resources" }, 400);
    }
    if (resource.lifecycle === "archived") {
      return json({ error: "cannot upload to archived resource" }, 400);
    }
    if (!resource.current_version_id) {
      return json({ error: "resource has no current version; save the draft first" }, 400);
    }

    if (action === "create_upload") {
      const filename = String(body?.filename ?? "").trim();
      const contentType = String(body?.content_type ?? "application/octet-stream");
      const sizeBytes = Number(body?.size_bytes ?? 0);
      if (!filename || filename.length > 200) return json({ error: "invalid filename" }, 400);
      if (!/^[\w.\-]+$/.test(filename)) return json({ error: "filename must be alphanumerics, dot, dash, underscore" }, 400);
      if (!ALLOWED_CONTENT.has(contentType)) return json({ error: `content_type not allowed: ${contentType}` }, 400);
      if (!(sizeBytes > 0) || sizeBytes > MAX_BYTES) return json({ error: `size must be 1..${MAX_BYTES} bytes` }, 400);

      const path = `${resourceId}/${resource.current_version_id}/${Date.now()}_${filename}`;
      const { data: signed, error: sErr } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(path);
      if (sErr || !signed) return json({ error: `signed url failed: ${sErr?.message ?? "unknown"}` }, 500);

      return json({
        bucket: BUCKET,
        path: signed.path,
        token: signed.token,
        signed_url: signed.signedUrl,
      });
    }

    if (action === "finalize_upload") {
      const path = String(body?.path ?? "");
      const sizeBytes = Number(body?.size_bytes ?? 0);
      const checksum = String(body?.checksum_sha256 ?? "");
      const contentType = String(body?.content_type ?? "application/octet-stream");
      const filename = String(body?.filename ?? "");
      if (!path || !path.startsWith(`${resourceId}/`)) return json({ error: "invalid path" }, 400);
      if (!(sizeBytes > 0) || sizeBytes > MAX_BYTES) return json({ error: "invalid size" }, 400);
      if (!/^[a-f0-9]{64}$/i.test(checksum)) return json({ error: "checksum_sha256 must be 64 hex chars" }, 400);

      // Confirm object exists in storage.
      const { data: head, error: hErr } = await admin.storage.from(BUCKET).createSignedUrl(path, 30);
      if (hErr || !head) return json({ error: "uploaded object not found in storage" }, 400);

      // Register on current version.
      const { error: fErr } = await admin.from("resource_files").insert({
        resource_version_id: resource.current_version_id,
        storage_bucket: BUCKET,
        storage_path: path,
        filename,
        content_type: contentType,
        size_bytes: sizeBytes,
        checksum_sha256: checksum.toLowerCase(),
      });
      if (fErr) return json({ error: `register file failed: ${fErr.message}` }, 500);

      // Enqueue scan (server-side scanner will pick this up and update status).
      const { error: scanErr } = await admin.from("package_scans").insert({
        resource_version_id: resource.current_version_id,
        status: "pending",
        scanner: "pending-external",
      });
      if (scanErr) {
        // Not fatal: file is registered. Return warning instead of erroring.
        return json({ ok: true, warning: `scan enqueue failed: ${scanErr.message}` });
      }

      return json({ ok: true });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

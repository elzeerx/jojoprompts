// admin-package-upload
// Admin-only signed upload path for private resource packages (skill/automation).
//
// Actions (exact request shape enforced; unknown keys rejected):
//
//   POST { action: "create_upload",
//          resource_id, resource_version_id,
//          file_name, size_bytes, content_type }
//     → { bucket, path, token, signed_url }
//
//   POST { action: "finalize_upload",
//          resource_id, resource_version_id,
//          path, file_name, size_bytes, content_type,
//          checksum_sha256_client }   // client-declared, stored unverified
//     → { ok: true, resource_file_id, scan_status: "pending" }
//
// Guarantees:
// - Strict origin allowlist (mirrors resource-download).
// - JWT identity via getClaims — no user-id from the client.
// - Storage object existence and byte-length verified via storage.list() metadata.
// - resource_files insert + pending package_scans insert are idempotent
//   (unique storage_path prevents duplicate registration).
// - If pending scan insert fails, we return 502 retryable so the client can retry
//   without leaving a file registered without a scan row.
// - checksum is stored as CLIENT-DECLARED. Not asserted server-side; the scanner
//   is the source of truth for cleanliness.

import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "resource-packages";
const MAX_BYTES = 200 * 1024 * 1024;

const ALLOWED_ORIGINS = new Set<string>([
  "https://jojoprompts.com",
  "https://www.jojoprompts.com",
  "https://jojoprompts.lovable.app",
  "https://id-preview--766f3370-d38c-42e5-8566-5e4946986dd2.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
]);

const ALLOWED_CONTENT_TYPES = new Set<string>([
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "application/json",
  "text/plain",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const HEX64_RE = /^[a-f0-9]{64}$/i;

function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const ERRORS = {
  UNAUTHENTICATED: { code: "unauthenticated", message: "Authentication required." },
  FORBIDDEN: { code: "forbidden", message: "Admin role required." },
  BAD_REQUEST: (m: string) => ({ code: "bad_request", message: m }),
  NOT_FOUND: (m: string) => ({ code: "not_found", message: m }),
  CONFLICT: (m: string) => ({ code: "conflict", message: m }),
  RETRYABLE: (m: string) => ({ code: "retryable", message: m }),
  SERVER: { code: "server_error", message: "Server error." },
};

const CREATE_KEYS = new Set([
  "action", "resource_id", "resource_version_id",
  "file_name", "size_bytes", "content_type",
]);
const FINALIZE_KEYS = new Set([
  "action", "resource_id", "resource_version_id",
  "path", "file_name", "size_bytes", "content_type",
  "checksum_sha256_client",
]);

function hasExactKeys(obj: Record<string, unknown>, allowed: Set<string>): boolean {
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  for (const k of keys) if (!allowed.has(k)) return false;
  return true;
}

Deno.serve(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(ERRORS.BAD_REQUEST("method"), 405, cors);

  let body: unknown;
  try { body = await req.json(); }
  catch { return json(ERRORS.BAD_REQUEST("invalid json"), 400, cors); }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return json(ERRORS.BAD_REQUEST("body must be object"), 400, cors);
  }
  const b = body as Record<string, unknown>;
  const action = b.action;
  if (action !== "create_upload" && action !== "finalize_upload") {
    return json(ERRORS.BAD_REQUEST("unknown action"), 400, cors);
  }

  // Auth: bearer JWT via getClaims (no client-supplied user id).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(ERRORS.UNAUTHENTICATED, 401, cors);
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) return json(ERRORS.UNAUTHENTICATED, 401, cors);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string;
  try {
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(jwt);
    if (claimsErr || !claims?.claims?.sub) return json(ERRORS.UNAUTHENTICATED, 401, cors);
    userId = claims.claims.sub as string;
  } catch { return json(ERRORS.UNAUTHENTICATED, 401, cors); }
  if (!UUID_RE.test(userId)) return json(ERRORS.UNAUTHENTICATED, 401, cors);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) return json(ERRORS.FORBIDDEN, 403, cors);

  // Common validated fields
  const resource_id = b.resource_id;
  const resource_version_id = b.resource_version_id;
  const file_name = b.file_name;
  const size_bytes = b.size_bytes;
  const content_type = b.content_type;

  if (typeof resource_id !== "string" || !UUID_RE.test(resource_id)) {
    return json(ERRORS.BAD_REQUEST("resource_id must be uuid"), 400, cors);
  }
  if (typeof resource_version_id !== "string" || !UUID_RE.test(resource_version_id)) {
    return json(ERRORS.BAD_REQUEST("resource_version_id must be uuid"), 400, cors);
  }
  if (typeof file_name !== "string" || !SAFE_FILE_RE.test(file_name)) {
    return json(ERRORS.BAD_REQUEST("file_name invalid"), 400, cors);
  }
  if (typeof size_bytes !== "number" || !Number.isInteger(size_bytes) ||
      size_bytes <= 0 || size_bytes > MAX_BYTES) {
    return json(ERRORS.BAD_REQUEST(`size_bytes must be 1..${MAX_BYTES}`), 400, cors);
  }
  if (typeof content_type !== "string" || !ALLOWED_CONTENT_TYPES.has(content_type)) {
    return json(ERRORS.BAD_REQUEST("content_type not allowed"), 400, cors);
  }

  // Verify the resource + version belong together, correct type, not archived.
  const { data: resource, error: rErr } = await admin
    .from("resources")
    .select("id, type, current_version_id, lifecycle")
    .eq("id", resource_id)
    .maybeSingle();
  if (rErr) { console.error("resources fetch", rErr); return json(ERRORS.SERVER, 500, cors); }
  if (!resource) return json(ERRORS.NOT_FOUND("resource"), 404, cors);
  if (resource.type !== "skill" && resource.type !== "automation") {
    return json(ERRORS.BAD_REQUEST("uploads only for skill/automation"), 400, cors);
  }
  if (resource.lifecycle === "archived") {
    return json(ERRORS.BAD_REQUEST("resource archived"), 400, cors);
  }
  if (resource.current_version_id !== resource_version_id) {
    return json(ERRORS.BAD_REQUEST("resource_version_id not current"), 400, cors);
  }

  const pathPrefix = `${resource_id}/${resource_version_id}/`;

  // -------------------------------------------------------------- create_upload
  if (action === "create_upload") {
    if (!hasExactKeys(b, CREATE_KEYS)) {
      return json(ERRORS.BAD_REQUEST("unknown or missing keys"), 400, cors);
    }
    const objectPath = `${pathPrefix}${Date.now()}_${file_name}`;
    const { data: signed, error: sErr } = await admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(objectPath);
    if (sErr || !signed) {
      console.error("createSignedUploadUrl", sErr?.message);
      return json(ERRORS.SERVER, 500, cors);
    }
    return json({
      bucket: BUCKET,
      path: signed.path,
      token: signed.token,
      signed_url: signed.signedUrl,
    }, 200, cors);
  }

  // ------------------------------------------------------------ finalize_upload
  if (!hasExactKeys(b, FINALIZE_KEYS)) {
    return json(ERRORS.BAD_REQUEST("unknown or missing keys"), 400, cors);
  }
  const path = b.path;
  const checksum = b.checksum_sha256_client;
  if (typeof path !== "string" || typeof checksum !== "string" || !HEX64_RE.test(checksum)) {
    return json(ERRORS.BAD_REQUEST("checksum_sha256_client must be 64 hex"), 400, cors);
  }
  // Strict path shape: <resource_id>/<version_id>/<13-digit-ts>_<file_name>
  const LEAF_RE = new RegExp(
    `^${resource_id}/${resource_version_id}/(\\d{13})_([A-Za-z0-9][A-Za-z0-9._-]{0,199})$`,
  );
  const m = path.match(LEAF_RE);
  if (!m || m[2] !== file_name) {
    return json(ERRORS.BAD_REQUEST("path invalid"), 400, cors);
  }
  const objectLeaf = `${m[1]}_${m[2]}`;

  // Verify object existence AND actual size by listing the version prefix.
  const { data: listed, error: lErr } = await admin.storage
    .from(BUCKET)
    .list(pathPrefix.slice(0, -1), { limit: 1000, search: objectLeaf });
  if (lErr) { console.error("storage list", lErr.message); return json(ERRORS.SERVER, 500, cors); }
  const object = (listed ?? []).find((o) => o.name === objectLeaf);
  if (!object) return json(ERRORS.NOT_FOUND("uploaded object"), 404, cors);
  const actualSize = (object.metadata as Record<string, unknown> | null)?.size;
  if (typeof actualSize !== "number" || actualSize !== size_bytes) {
    return json(ERRORS.BAD_REQUEST(
      `declared size ${size_bytes} does not match uploaded ${actualSize ?? "unknown"}`,
    ), 400, cors);
  }

  // Atomic registration + pending scan + audit via SECURITY DEFINER RPC.
  // If any step fails, the entire transaction rolls back.
  const { data: rpc, error: rpcErr } = await admin.rpc(
    "admin_finalize_resource_package",
    {
      p_actor_user_id: userId,
      p_resource_id: resource_id,
      p_resource_version_id: resource_version_id,
      p_storage_bucket: BUCKET,
      p_storage_path: path,
      p_file_name: file_name,
      p_content_type: content_type,
      p_size_bytes: size_bytes,
      p_checksum_sha256_client: checksum.toLowerCase(),
    },
  );
  if (rpcErr) {
    const msg = rpcErr.message ?? "";
    console.error("admin_finalize_resource_package", msg);
    if (msg.includes("forbidden")) return json(ERRORS.FORBIDDEN, 403, cors);
    if (msg.includes("resource_not_found") || msg.includes("version_not_found")) {
      return json(ERRORS.NOT_FOUND("resource or version"), 404, cors);
    }
    if (msg.includes("path_conflict")) return json(ERRORS.CONFLICT("path already registered with different metadata"), 409, cors);
    if (msg.includes("invalid_resource_type") || msg.includes("resource_archived") || msg.includes("version_not_current")) {
      return json(ERRORS.BAD_REQUEST(msg.replace(/.*"([^"]+)".*/, "$1")), 400, cors);
    }
    return json(ERRORS.RETRYABLE("finalize failed; retry"), 502, cors);
  }
  const result = rpc as {
    ok: boolean;
    resource_file_id: string;
    newly_registered: boolean;
    scan_created: boolean;
    scan_status: string;
  };

  return json(
    {
      ok: true,
      resource_file_id: result.resource_file_id,
      newly_registered: result.newly_registered,
      scan_created: result.scan_created,
      scan_status: result.scan_status,
      checksum_verified: false,
    },
    200,
    cors,
  );
});

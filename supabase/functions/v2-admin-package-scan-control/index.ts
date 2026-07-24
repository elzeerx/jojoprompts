// v2-admin-package-scan-control (verify_jwt=true)
// Admin-only control plane for MetaDefender Cloud package scans.
// - provider_status: returns safe readiness facts only.
// - queue_scan: validates readiness + preconditions, creates a durable scan
//   run via the internal RPC, then kicks the worker server-to-server with the
//   worker secret. Never exposes the worker secret.
// - refresh_scan: admin-only nudge that reinvokes the worker for a scan.
//
// Guardrails:
//   * Fails closed when METADEFENDER_API_KEY or PACKAGE_SCAN_WORKER_SECRET
//     is missing.
//   * Never contacts the provider in `queue_scan`/`refresh_scan` beyond the
//     shared readiness probe; the worker owns the /file lifecycle.
//   * Returns stable safe error codes; no provider text is echoed back.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  evaluateReadiness,
  probeMetadefenderReadiness,
  SCANNER_NAME,
  type ReadinessResult,
} from "../_shared/metadefender.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(code: string, status = 400): Response {
  return json({ ok: false, error: code }, status);
}

async function probeProvider(apiKey: string): Promise<ReadinessResult> {
  return await probeMetadefenderReadiness(
    apiKey,
    Deno.env.get("PACKAGE_SCAN_WORKER_SECRET"),
  );
}

async function requireAdmin(req: Request): Promise<
  { ok: true; userId: string; supabase: ReturnType<typeof createClient> }
  | { ok: false; res: Response }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, res: err("unauthorized", 401) };
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await userClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return { ok: false, res: err("unauthorized", 401) };
  }
  const userId = data.claims.sub as string;
  const service = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: isAdmin, error: roleErr } = await service.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleErr || !isAdmin) {
    return { ok: false, res: err("forbidden", 403) };
  }
  return { ok: true, userId, supabase: service };
}

async function invokeWorker(scanId: string): Promise<void> {
  const workerSecret = Deno.env.get("PACKAGE_SCAN_WORKER_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!workerSecret || !supabaseUrl) return;
  try {
    await fetch(`${supabaseUrl}/functions/v1/v2-package-scan-worker`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-scan-worker-secret": workerSecret,
      },
      body: JSON.stringify({ scan_id: scanId }),
    });
  } catch {
    // Worker will also be retried by future refresh actions; swallow here.
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return err("method_not_allowed", 405);

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return err("invalid_json", 400);
  }

  const action = String(payload.action ?? "");
  const apiKey = Deno.env.get("METADEFENDER_API_KEY") ?? "";
  const workerSecret = Deno.env.get("PACKAGE_SCAN_WORKER_SECRET") ?? "";

  if (action === "provider_status") {
    if (!apiKey) {
      return json({
        ok: true,
        provider: "metadefender_cloud",
        readiness: evaluateReadiness({ hasApiKey: false, hasWorkerSecret: !!workerSecret }),
      });
    }
    const readiness = await probeProvider(apiKey);
    return json({ ok: true, provider: "metadefender_cloud", readiness });
  }

  if (action === "queue_scan") {
    const versionId = String(payload.version_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(versionId)) return err("invalid_version_id", 400);
    if (!apiKey) return err("no_api_key", 412);
    if (!workerSecret) return err("no_worker_secret", 412);

    const readiness = await probeProvider(apiKey);
    if (!readiness.ready) {
      return json({ ok: false, error: "not_ready", readiness }, 412);
    }

    // Preflight: at least one file, no pending run, not all-clean already.
    const { data: files, error: filesErr } = await auth.supabase
      .from("resource_files")
      .select("id")
      .eq("resource_version_id", versionId);
    if (filesErr) return err("db_error", 500);
    if (!files || files.length === 0) return err("no_files", 412);

    const { data: existingPending } = await auth.supabase
      .from("package_scans")
      .select("id")
      .eq("resource_version_id", versionId)
      .eq("status", "pending")
      .limit(1);
    if (existingPending && existingPending.length > 0) {
      return err("pending_exists", 409);
    }

    const { data: scanId, error: rpcErr } = await auth.supabase.rpc(
      "v2_internal_create_package_scan",
      {
        p_version_id: versionId,
        p_scanner: SCANNER_NAME,
        p_requested_by: auth.userId,
      },
    );
    if (rpcErr || !scanId) {
      const code =
        rpcErr?.message?.includes("pending_exists") ? "pending_exists"
        : rpcErr?.message?.includes("no_files") ? "no_files"
        : "db_error";
      return err(code, code === "db_error" ? 500 : 409);
    }

    // Fire-and-forget worker kick.
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(invokeWorker(scanId as string));
    else invokeWorker(scanId as string);

    return json({ ok: true, scan_id: scanId });
  }

  if (action === "refresh_scan") {
    const scanId = String(payload.scan_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(scanId)) return err("invalid_scan_id", 400);
    if (!apiKey || !workerSecret) return err("not_configured", 412);

    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(invokeWorker(scanId));
    else invokeWorker(scanId);
    return json({ ok: true, scan_id: scanId });
  }

  return err("unknown_action", 400);
});

// v2-admin-package-scan-control (verify_jwt=true)
// Admin-only control plane for Cloudmersive Virus Scan (advanced) package
// scans.
// - provider_status: returns safe configuration facts only (no provider call).
// - queue_scan: validates readiness + preconditions, creates a durable scan
//   run via the internal RPC, then kicks the worker server-to-server with the
//   worker secret. Never exposes the worker secret.
// - refresh_scan: admin-only nudge that reinvokes the worker for a scan.
//
// Guardrails:
//   * Fails closed when CLOUDMERSIVE_API_KEY or PACKAGE_SCAN_WORKER_SECRET
//     is missing.
//   * Readiness is credentials-only (no /apikey probe); credential validity is
//     verified on the first real scan.
//   * Returns stable safe error codes; no provider text is echoed back.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  decideQueueAllowed,
  decideRefreshAllowed,
  evaluateReadiness,
  type NormalizedStatus,
  type ReadinessResult,
  SCANNER_NAME,
} from "../_shared/scanProvider.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(code: string, status = 400): Response {
  return json({ ok: false, error: code }, status);
}

function currentReadiness(): ReadinessResult {
  return evaluateReadiness({
    hasApiKey: !!Deno.env.get("CLOUDMERSIVE_API_KEY"),
    hasWorkerSecret: !!Deno.env.get("PACKAGE_SCAN_WORKER_SECRET"),
  });
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

  if (action === "provider_status") {
    return json({
      ok: true,
      provider: SCANNER_NAME,
      readiness: currentReadiness(),
    });
  }

  if (action === "queue_scan") {
    const versionId = String(payload.version_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(versionId)) return err("invalid_version_id", 400);

    const readiness = currentReadiness();
    if (!readiness.ready) {
      return json({ ok: false, error: "not_ready", readiness }, 412);
    }

    // Preflight: files present.
    const { data: files, error: filesErr } = await auth.supabase
      .from("resource_files")
      .select("id")
      .eq("resource_version_id", versionId);
    if (filesErr) return err("db_error", 500);
    const hasFiles = !!(files && files.length > 0);

    // Latest scan for admission gates.
    const { data: latestScan, error: latestErr } = await auth.supabase
      .from("package_scans")
      .select("id, status")
      .eq("resource_version_id", versionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestErr) return err("db_error", 500);

    // Pending child items across ANY scan for this version.
    const { data: allScans, error: allScansErr } = await auth.supabase
      .from("package_scans")
      .select("id")
      .eq("resource_version_id", versionId);
    if (allScansErr) return err("db_error", 500);
    const allScanIds = (allScans ?? []).map((s: { id: string }) => s.id);
    let hasAnyPendingChild = false;
    if (allScanIds.length > 0) {
      const probe = await auth.supabase
        .from("package_scan_items")
        .select("id")
        .in("scan_id", allScanIds)
        .eq("status", "pending")
        .limit(1);
      hasAnyPendingChild = (probe.data?.length ?? 0) > 0;
    }

    const decision = decideQueueAllowed({
      latestScanStatus: (latestScan?.status as NormalizedStatus | undefined) ?? null,
      hasAnyPendingChild,
      hasFiles,
      providerReady: readiness.ready,
    });
    if (!decision.allow) {
      const status =
        decision.reason === "no_files" ? 412
        : decision.reason === "not_ready" ? 412
        : 409;
      return err(decision.reason, status);
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
      const msg = rpcErr?.message ?? "";
      const code =
        msg.includes("already_clean") ? "already_clean"
        : msg.includes("pending_exists") ? "pending_exists"
        : msg.includes("no_files") ? "no_files"
        : "db_error";
      const status = code === "db_error" ? 500 : (code === "no_files" ? 412 : 409);
      return err(code, status);
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

    const readiness = currentReadiness();
    if (!readiness.ready) {
      return json({ ok: false, error: "not_ready", readiness }, 412);
    }

    // Verify existence.
    const { data: scan, error: scanErr } = await auth.supabase
      .from("package_scans")
      .select("id")
      .eq("id", scanId)
      .maybeSingle();
    if (scanErr) return err("db_error", 500);

    let pendingCount = 0;
    if (scan) {
      const { data: pending, error: pendingErr } = await auth.supabase
        .from("package_scan_items")
        .select("id")
        .eq("scan_id", scanId)
        .eq("status", "pending");
      if (pendingErr) return err("db_error", 500);
      pendingCount = pending?.length ?? 0;
    }

    const decision = decideRefreshAllowed({
      scanExists: !!scan,
      pendingItemCount: pendingCount,
    });
    if (!decision.allow) {
      return err(decision.reason, decision.reason === "scan_not_found" ? 404 : 409);
    }

    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(invokeWorker(scanId));
    else invokeWorker(scanId);
    return json({ ok: true, scan_id: scanId });
  }

  return err("unknown_action", 400);
});

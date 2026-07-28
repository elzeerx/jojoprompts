// v2-package-scan-worker (verify_jwt=false)
// Server-to-server worker for Cloudmersive Virus Scan (advanced) private scans.
// - Auth: constant-time comparison against PACKAGE_SCAN_WORKER_SECRET header.
//   Never accepts a browser JWT as substitute. Not intended for CORS.
// - Uses service-role client. Claims one item at a time (bounded per invocation),
//   downloads the private object from the resource-packages bucket ONLY,
//   verifies size + SHA-256 against the stored resource_files metadata, then
//   POSTs bytes to Cloudmersive /virus/scan/file/advanced with strict policy
//   headers, and persists the normalized result via the apply RPC.
// - Never logs secrets, file bytes, bucket/path, signed URLs, checksums, or
//   raw provider response bodies.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  bytesEqualConstantTime,
  classifyHttpStatus,
  CLOUDMERSIVE_ADVANCED_SCAN_URL,
  CLOUDMERSIVE_POLICY_HEADERS,
  constantTimeEqual,
  decideReadinessPersistence,
  evaluateReadiness,
  mapAdvancedScanBody,
  nextPollDelayMs,
  RESOURCE_PACKAGES_BUCKET,
  sanitizeFileName,
  sha256Hex,
  shouldStopForAttempts,
  validateIntegrityMetadata,
} from "../_shared/scanProvider.ts";

const SCAN_TIMEOUT_MS = 90_000;
const MAX_WORK_PER_INVOCATION = 3;

function ok(body: unknown = { ok: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
function fail(code: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// deno-lint-ignore no-explicit-any
async function failItem(supabase: any, itemId: string, reason: string, findings: Record<string, unknown> | null = null): Promise<void> {
  await supabase.rpc("v2_internal_apply_scan_item_result", {
    p_item_id: itemId,
    p_status: "failed",
    p_result_code: null,
    p_progress: 100,
    p_total_engines: null,
    p_detected_engines: null,
    p_findings: findings ?? { reason },
    p_next_poll_at: null,
    p_last_error_code: reason,
  });
}

// deno-lint-ignore no-explicit-any
async function applyTerminal(supabase: any, itemId: string, status: "clean" | "suspicious" | "malicious", findings: Record<string, unknown>, reason: string): Promise<void> {
  await supabase.rpc("v2_internal_apply_scan_item_result", {
    p_item_id: itemId,
    p_status: status,
    p_result_code: null,
    p_progress: 100,
    p_total_engines: null,
    p_detected_engines: null,
    p_findings: findings,
    p_next_poll_at: null,
    p_last_error_code: status === "clean" ? null : reason,
  });
}

// deno-lint-ignore no-explicit-any
async function retryItem(supabase: any, itemId: string, attempt: number, reason: string): Promise<void> {
  const delay = nextPollDelayMs(attempt);
  await supabase.rpc("v2_internal_apply_scan_item_result", {
    p_item_id: itemId,
    p_status: "pending",
    p_result_code: null,
    p_progress: 0,
    p_total_engines: null,
    p_detected_engines: null,
    p_findings: null,
    p_next_poll_at: new Date(Date.now() + delay).toISOString(),
    p_last_error_code: reason,
  });
}

// Persist readiness fail state across all pending items for a scan WITHOUT any
// storage/provider I/O. Called before any file work when readiness is not ok.
// deno-lint-ignore no-explicit-any
async function persistReadinessFailure(
  supabase: any,
  scanId: string,
  reasonSuffix: string,
): Promise<void> {
  const { data: pending } = await supabase
    .from("package_scan_items")
    .select("id")
    .eq("package_scan_id", scanId)
    .eq("status", "pending");

  for (const item of (pending ?? []) as Array<{ id: string }>) {
    await failItem(supabase, item.id, `provider_not_ready_${reasonSuffix}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const expected = Deno.env.get("PACKAGE_SCAN_WORKER_SECRET") ?? "";
  const provided = req.headers.get("x-scan-worker-secret") ?? "";
  if (!expected || !constantTimeEqual(provided, expected)) {
    return fail("unauthorized", 401);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return fail("invalid_json", 400);
  }
  const scanId = String(payload.scan_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(scanId)) return fail("invalid_scan_id", 400);

  // Initialize the service client BEFORE readiness handling so we can persist
  // a safe state for pending items even when configuration is bad.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const apiKey = Deno.env.get("CLOUDMERSIVE_API_KEY") ?? "";

  // Configuration-only readiness. No provider request.
  const readiness = evaluateReadiness({
    hasApiKey: !!apiKey,
    hasWorkerSecret: !!expected,
  });
  if (!readiness.ready) {
    const decision = decideReadinessPersistence(readiness.reason);
    if (decision === "fail_now") {
      await persistReadinessFailure(supabase, scanId, readiness.reason);
    }
    return fail(`not_ready:${readiness.reason}`, 412);
  }

  let workDone = 0;

  const { data: claims, error: claimErr } = await supabase.rpc(
    "v2_internal_claim_scan_items",
    { p_scan_id: scanId, p_max: MAX_WORK_PER_INVOCATION },
  );
  if (claimErr) return fail("claim_failed", 500);

  for (const claim of (claims as Array<{ item_id: string; resource_file_id: string; attempt_count: number }> ?? [])) {
    if (workDone >= MAX_WORK_PER_INVOCATION) break;
    workDone++;

    // >= after the claim increment: stop provider I/O at the configured max.
    if (shouldStopForAttempts(claim.attempt_count)) {
      await failItem(supabase, claim.item_id, "max_attempts");
      continue;
    }

    // Look up the file's storage location + integrity metadata.
    const { data: file, error: fileErr } = await supabase
      .from("resource_files")
      .select("id, storage_bucket, storage_path, file_name, size_bytes, content_type, checksum_sha256")
      .eq("id", claim.resource_file_id)
      .maybeSingle();

    if (fileErr || !file) {
      await failItem(supabase, claim.item_id, "file_missing");
      continue;
    }

    // Bucket allowlist — reject any other bucket outright.
    if ((file as { storage_bucket?: string }).storage_bucket !== RESOURCE_PACKAGES_BUCKET) {
      await failItem(supabase, claim.item_id, "bucket_not_allowed");
      continue;
    }

    // Mandatory integrity metadata BEFORE any storage download.
    const integrity = validateIntegrityMetadata({
      size_bytes: (file as { size_bytes: number | null }).size_bytes,
      checksum_sha256: (file as { checksum_sha256: string | null }).checksum_sha256,
    });
    if (!integrity.ok) {
      await failItem(supabase, claim.item_id, integrity.reason);
      continue;
    }

    const path = (file as { storage_path: string }).storage_path;
    const { data: blob, error: dlErr } = await supabase.storage
      .from(RESOURCE_PACKAGES_BUCKET)
      .download(path);
    if (dlErr || !blob) {
      await retryItem(supabase, claim.item_id, claim.attempt_count, "storage_download_error");
      continue;
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());

    if (bytes.length !== integrity.size) {
      await failItem(supabase, claim.item_id, "size_mismatch");
      continue;
    }

    {
      const actualHex = await sha256Hex(bytes);
      const expectedHex = integrity.checksumHex;
      const a = new Uint8Array(actualHex.length / 2);
      const b = new Uint8Array(expectedHex.length / 2);
      for (let i = 0; i < a.length; i++) a[i] = parseInt(actualHex.substr(i * 2, 2), 16);
      for (let i = 0; i < b.length; i++) b[i] = parseInt(expectedHex.substr(i * 2, 2), 16);
      if (!bytesEqualConstantTime(a, b)) {
        await failItem(supabase, claim.item_id, "checksum_mismatch");
        continue;
      }
    }

    const safeName = sanitizeFileName((file as { file_name: string }).file_name);

    // Synchronous Cloudmersive advanced scan. Let FormData set the multipart
    // boundary; do NOT set content-type manually.
    const form = new FormData();
    form.append(
      "inputFile",
      new Blob([bytes], { type: "application/octet-stream" }),
      safeName,
    );

    let httpStatus = 0;
    let body: unknown = null;
    try {
      const res = await fetchWithTimeout(
        CLOUDMERSIVE_ADVANCED_SCAN_URL,
        {
          method: "POST",
          headers: {
            Apikey: apiKey,
            accept: "application/json",
            fileName: safeName,
            ...CLOUDMERSIVE_POLICY_HEADERS,
          },
          body: form,
        },
        SCAN_TIMEOUT_MS,
      );
      httpStatus = res.status;
      try { body = await res.json(); } catch { body = null; }
    } catch {
      httpStatus = 0;
    }

    const cls = classifyHttpStatus(httpStatus);
    if (cls.kind === "terminal") {
      await failItem(supabase, claim.item_id, cls.reason);
      continue;
    }
    if (cls.kind === "transient") {
      await retryItem(supabase, claim.item_id, claim.attempt_count, cls.reason);
      continue;
    }

    const mapped = mapAdvancedScanBody(body);
    const findings = { ...mapped.summary, reason: mapped.reason } as Record<string, unknown>;
    if (mapped.status === "failed") {
      await failItem(supabase, claim.item_id, mapped.reason, findings);
    } else {
      await applyTerminal(supabase, claim.item_id, mapped.status, findings, mapped.reason);
    }
  }

  return ok({ ok: true, work_done: workDone });
});

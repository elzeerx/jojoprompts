// v2-package-scan-worker (verify_jwt=false)
// Server-to-server worker for MetaDefender Cloud private scans.
// - Auth: constant-time comparison against PACKAGE_SCAN_WORKER_SECRET header.
//   Never accepts a browser JWT as substitute. Not intended for CORS.
// - Uses service-role client. Claims one item at a time (bounded per invocation),
//   downloads the private object from the resource-packages bucket ONLY,
//   verifies size + SHA-256 against the stored resource_files metadata, then
//   POSTs bytes to /file with samplesharing:0 and privateProcessing:1, and
//   polls /file/{data_id} via the poll-claim RPC so poll work is leased too.
// - Never logs secrets, file bytes, bucket/path, signed URLs, checksums, or
//   raw provider response bodies.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  bytesEqualConstantTime,
  constantTimeEqual,
  MAX_ITEM_ATTEMPTS,
  METADEFENDER_BASE,
  nextPollDelayMs,
  normalizeHexChecksum,
  normalizeProviderResponse,
  probeMetadefenderReadiness,
  RESOURCE_PACKAGES_BUCKET,
  sanitizeFileName,
  sha256Hex,
} from "../_shared/metadefender.ts";

const UPLOAD_TIMEOUT_MS = 60_000;
const POLL_TIMEOUT_MS = 10_000;
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
async function failItem(supabase: any, itemId: string, reason: string): Promise<void> {
  await supabase.rpc("v2_internal_apply_scan_item_result", {
    p_item_id: itemId,
    p_status: "failed",
    p_result_code: null,
    p_progress: 100,
    p_total_engines: null,
    p_detected_engines: null,
    p_findings: { reason },
    p_next_poll_at: null,
    p_last_error_code: reason,
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const expected = Deno.env.get("PACKAGE_SCAN_WORKER_SECRET") ?? "";
  const provided = req.headers.get("x-scan-worker-secret") ?? "";
  if (!expected || !constantTimeEqual(provided, expected)) {
    return fail("unauthorized", 401);
  }

  const apiKey = Deno.env.get("METADEFENDER_API_KEY") ?? "";
  if (!apiKey) return fail("no_api_key", 412);

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    return fail("invalid_json", 400);
  }
  const scanId = String(payload.scan_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(scanId)) return fail("invalid_scan_id", 400);

  // Fail closed before ANY storage/provider I/O if provider isn't fully ready.
  const readiness = await probeMetadefenderReadiness(apiKey, expected);
  if (!readiness.ready) {
    // Do not attempt any upload/poll. Return safe reason for observability.
    return fail(`not_ready:${readiness.reason}`, 412);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let workDone = 0;

  // ---------- 1) Submit unsubmitted items (leased claim) ----------
  const { data: claims, error: claimErr } = await supabase.rpc(
    "v2_internal_claim_scan_items",
    { p_scan_id: scanId, p_max: MAX_WORK_PER_INVOCATION },
  );
  if (claimErr) return fail("claim_failed", 500);

  for (const claim of (claims as Array<{ item_id: string; resource_file_id: string; attempt_count: number }> ?? [])) {
    if (workDone >= MAX_WORK_PER_INVOCATION) break;
    workDone++;

    if (claim.attempt_count > MAX_ITEM_ATTEMPTS) {
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

    const expectedSize = (file as { size_bytes: number | null }).size_bytes;
    const expectedChecksum = normalizeHexChecksum(
      (file as { checksum_sha256: string | null }).checksum_sha256,
    );

    const path = (file as { storage_path: string }).storage_path;
    const { data: blob, error: dlErr } = await supabase.storage
      .from(RESOURCE_PACKAGES_BUCKET)
      .download(path);
    if (dlErr || !blob) {
      await retryItem(supabase, claim.item_id, claim.attempt_count, "storage_download_error");
      continue;
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());

    // Size check.
    if (typeof expectedSize === "number" && bytes.length !== expectedSize) {
      await failItem(supabase, claim.item_id, "size_mismatch");
      continue;
    }

    // Checksum check (constant-time compare of raw digest bytes).
    if (expectedChecksum) {
      const actualHex = await sha256Hex(bytes);
      const a = new Uint8Array(actualHex.length / 2);
      const b = new Uint8Array(expectedChecksum.length / 2);
      for (let i = 0; i < a.length; i++) a[i] = parseInt(actualHex.substr(i * 2, 2), 16);
      for (let i = 0; i < b.length; i++) b[i] = parseInt(expectedChecksum.substr(i * 2, 2), 16);
      if (!bytesEqualConstantTime(a, b)) {
        await failItem(supabase, claim.item_id, "checksum_mismatch");
        continue;
      }
    }

    const safeName = sanitizeFileName((file as { file_name: string }).file_name);

    let submitStatus = 0;
    let submitBody: unknown = null;
    try {
      const res = await fetchWithTimeout(
        `${METADEFENDER_BASE}/file`,
        {
          method: "POST",
          headers: {
            apikey: apiKey,
            filename: safeName,
            samplesharing: "0",
            privateProcessing: "1",
            "content-type": "application/octet-stream",
          },
          body: bytes,
        },
        UPLOAD_TIMEOUT_MS,
      );
      submitStatus = res.status;
      try { submitBody = await res.json(); } catch { submitBody = null; }
    } catch {
      submitStatus = 0;
    }

    if (submitStatus === 401 || submitStatus === 403) {
      await failItem(supabase, claim.item_id, "provider_unauthorized");
      continue;
    }

    const dataId =
      submitBody && typeof submitBody === "object"
        ? (submitBody as Record<string, unknown>).data_id
        : null;

    if (submitStatus !== 200 || typeof dataId !== "string" || !dataId) {
      await retryItem(supabase, claim.item_id, claim.attempt_count, "submit_retry");
      continue;
    }

    const initialDelay = nextPollDelayMs(0);
    await supabase.rpc("v2_internal_record_scan_submission", {
      p_item_id: claim.item_id,
      p_data_id: dataId,
      p_next_poll_at: new Date(Date.now() + initialDelay).toISOString(),
    });
  }

  // ---------- 2) Poll submitted items via leased poll-claim ----------
  const { data: pollables, error: pollClaimErr } = await supabase.rpc(
    "v2_internal_claim_scan_poll_items",
    { p_scan_id: scanId, p_max: MAX_WORK_PER_INVOCATION },
  );
  if (pollClaimErr) return ok({ ok: true, work_done: workDone });

  for (const it of (pollables as Array<{ item_id: string; provider_data_id: string; attempt_count: number }> ?? [])) {
    if (workDone >= MAX_WORK_PER_INVOCATION * 2) break;
    workDone++;

    if (it.attempt_count > MAX_ITEM_ATTEMPTS) {
      await failItem(supabase, it.item_id, "max_attempts");
      continue;
    }

    let pollStatus = 0;
    let pollBody: unknown = null;
    try {
      const res = await fetchWithTimeout(
        `${METADEFENDER_BASE}/file/${encodeURIComponent(it.provider_data_id)}`,
        { method: "GET", headers: { apikey: apiKey, accept: "application/json" } },
        POLL_TIMEOUT_MS,
      );
      pollStatus = res.status;
      try { pollBody = await res.json(); } catch { pollBody = null; }
    } catch {
      pollStatus = 0;
    }

    if (pollStatus === 401 || pollStatus === 403) {
      await failItem(supabase, it.item_id, "provider_unauthorized");
      continue;
    }

    if (pollStatus !== 200 || !pollBody) {
      await retryItem(supabase, it.item_id, it.attempt_count, "poll_retry");
      continue;
    }

    const { status, summary } = normalizeProviderResponse(pollBody);
    const nextPoll =
      status === "pending"
        ? new Date(Date.now() + nextPollDelayMs(it.attempt_count)).toISOString()
        : null;

    await supabase.rpc("v2_internal_apply_scan_item_result", {
      p_item_id: it.item_id,
      p_status: status,
      p_result_code: summary.code,
      p_progress: summary.progress,
      p_total_engines: summary.total_engines,
      p_detected_engines: summary.detected_engines,
      p_findings: summary as unknown as Record<string, unknown>,
      p_next_poll_at: nextPoll,
      p_last_error_code: summary.error_code,
    });
  }

  return ok({ ok: true, work_done: workDone });
});

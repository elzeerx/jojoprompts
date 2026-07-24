import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  aggregateItemStatuses,
  bytesEqualConstantTime,
  constantTimeEqual,
  decideQueueAllowed,
  decideReadinessPersistence,
  decideRefreshAllowed,
  evaluateReadiness,
  MAX_ITEM_ATTEMPTS,
  mapResultCode,
  nextPollDelayMs,
  normalizeHexChecksum,
  normalizeProviderResponse,
  resolveItemStatus,
  sanitizeErrorMessage,
  sanitizeFileName,
  sha256Hex,
  shouldStopForAttempts,
  validateIntegrityMetadata,
} from "./metadefender.ts";


// -------------------------- mapResultCode --------------------------

Deno.test("mapResultCode: 254/255 pending regardless of progress", () => {
  assertEquals(mapResultCode(254, 100), "pending");
  assertEquals(mapResultCode(255, 100), "pending");
});

Deno.test("mapResultCode: progress<100 pending even with code 0", () => {
  assertEquals(mapResultCode(0, 99), "pending");
});

Deno.test("mapResultCode: 0 clean, 1 malicious, 2 suspicious", () => {
  assertEquals(mapResultCode(0, 100), "clean");
  assertEquals(mapResultCode(1, 100), "malicious");
  assertEquals(mapResultCode(2, 100), "suspicious");
});

Deno.test("mapResultCode: known failed codes -> failed", () => {
  for (const c of [3, 16, 19, 23, 252, 253]) {
    assertEquals(mapResultCode(c, 100), "failed", `code ${c}`);
  }
});

Deno.test("mapResultCode: unknown terminal code fails closed", () => {
  assertEquals(mapResultCode(999, 100), "failed");
  assertEquals(mapResultCode(-1, 100), "failed");
});

Deno.test("mapResultCode: null code AT progress=100 fails closed (unknown terminal)", () => {
  // Correction: previously returned pending; only 254/255 or progress<100 is pending.
  assertEquals(mapResultCode(null, 100), "failed");
  assertEquals(mapResultCode(undefined, 100), "failed");
});

Deno.test("mapResultCode: null code with progress<100 stays pending", () => {
  assertEquals(mapResultCode(null, 50), "pending");
});

// -------------------------- item precedence / aggregate --------------------------

Deno.test("resolveItemStatus: never downgrades", () => {
  assertEquals(resolveItemStatus("clean", "pending"), "clean");
  assertEquals(resolveItemStatus("clean", "failed"), "clean");
  assertEquals(resolveItemStatus("failed", "pending"), "failed");
  assertEquals(resolveItemStatus("suspicious", "clean"), "suspicious");
  assertEquals(resolveItemStatus("malicious", "suspicious"), "malicious");
  assertEquals(resolveItemStatus("malicious", "clean"), "malicious");
});

Deno.test("resolveItemStatus: stronger signal upgrades", () => {
  // failed -> clean upgrades (clean rank > failed rank).
  assertEquals(resolveItemStatus("failed", "clean"), "clean");
  // clean -> suspicious upgrades.
  assertEquals(resolveItemStatus("clean", "suspicious"), "suspicious");
  // clean -> malicious upgrades.
  assertEquals(resolveItemStatus("clean", "malicious"), "malicious");
  // pending -> anything upgrades.
  assertEquals(resolveItemStatus("pending", "failed"), "failed");
  assertEquals(resolveItemStatus("pending", "clean"), "clean");
});

Deno.test("resolveItemStatus: equal is preserved", () => {
  assertEquals(resolveItemStatus("clean", "clean"), "clean");
});

Deno.test("aggregateItemStatuses: malicious wins even with clean+failed", () => {
  assertEquals(
    aggregateItemStatuses(["clean", "failed", "malicious"]),
    "malicious",
  );
});

Deno.test("aggregateItemStatuses: suspicious beats failed and clean", () => {
  assertEquals(
    aggregateItemStatuses(["clean", "failed", "suspicious"]),
    "suspicious",
  );
});

Deno.test("aggregateItemStatuses: failed beats clean when any failed", () => {
  assertEquals(aggregateItemStatuses(["clean", "failed"]), "failed");
});

Deno.test("aggregateItemStatuses: clean only if every item clean", () => {
  assertEquals(aggregateItemStatuses(["clean", "clean"]), "clean");
});

Deno.test("aggregateItemStatuses: pending when unresolved and no strong signal", () => {
  assertEquals(aggregateItemStatuses(["clean", "pending"]), "pending");
});

Deno.test("aggregateItemStatuses: empty is pending", () => {
  assertEquals(aggregateItemStatuses([]), "pending");
});

// -------------------------- readiness --------------------------

Deno.test("evaluateReadiness: no api key", () => {
  const r = evaluateReadiness({ hasApiKey: false, hasWorkerSecret: true });
  assertEquals(r.reason, "no_api_key");
  assertEquals(r.configured, false);
  assertEquals(r.ready, false);
});

Deno.test("evaluateReadiness: no worker secret", () => {
  const r = evaluateReadiness({ hasApiKey: true, hasWorkerSecret: false });
  assertEquals(r.reason, "no_worker_secret");
  assertEquals(r.ready, false);
});

Deno.test("evaluateReadiness: provider unauthorized", () => {
  const r = evaluateReadiness({
    hasApiKey: true,
    hasWorkerSecret: true,
    probeStatus: 401,
  });
  assertEquals(r.reason, "provider_unauthorized");
});

Deno.test("evaluateReadiness: provider unreachable on 5xx", () => {
  const r = evaluateReadiness({
    hasApiKey: true,
    hasWorkerSecret: true,
    probeStatus: 502,
  });
  assertEquals(r.reason, "provider_unreachable");
});

Deno.test("evaluateReadiness: not paid", () => {
  const r = evaluateReadiness({
    hasApiKey: true,
    hasWorkerSecret: true,
    probeStatus: 200,
    account: { paid_user: 0, max_upload_file_size: 200 * 1024 * 1024, scan_with: "engines", enforce_private_scan: true },
  });
  assertEquals(r.reason, "not_paid_account");
});

Deno.test("evaluateReadiness: upload too small", () => {
  const r = evaluateReadiness({
    hasApiKey: true,
    hasWorkerSecret: true,
    probeStatus: 200,
    account: { paid_user: 1, max_upload_file_size: 5 * 1024 * 1024, scan_with: "engines", enforce_private_scan: true },
  });
  assertEquals(r.reason, "upload_size_too_small");
});

Deno.test("evaluateReadiness: no engines", () => {
  const r = evaluateReadiness({
    hasApiKey: true,
    hasWorkerSecret: true,
    probeStatus: 200,
    account: { paid_user: 1, max_upload_file_size: 200 * 1024 * 1024, scan_with: "none", enforce_private_scan: true },
  });
  assertEquals(r.reason, "no_scan_engines");
});

Deno.test("evaluateReadiness: private scan not enforced (neither level)", () => {
  const r = evaluateReadiness({
    hasApiKey: true,
    hasWorkerSecret: true,
    probeStatus: 200,
    account: { paid_user: 1, max_upload_file_size: 200 * 1024 * 1024, scan_with: "engines", enforce_private_scan: false },
  });
  assertEquals(r.reason, "private_scan_not_enforced");
  assertEquals(r.ready, false);
});

Deno.test("evaluateReadiness: enforced at org level counts", () => {
  const r = evaluateReadiness({
    hasApiKey: true,
    hasWorkerSecret: true,
    probeStatus: 200,
    account: {
      paid_user: 1,
      max_upload_file_size: 200 * 1024 * 1024,
      scan_with: "engines",
      enforce_private_scan: false,
      organization: { enforce_private_scan: true },
    },
  });
  assertEquals(r.ready, true);
  assertEquals(r.reason, "ok");
  assertEquals(r.max_upload_mb, 200);
  assertEquals(r.private_scan_enforced, true);
  assertEquals(r.license_ready, true);
});

Deno.test("evaluateReadiness: happy path ready", () => {
  const r = evaluateReadiness({
    hasApiKey: true,
    hasWorkerSecret: true,
    probeStatus: 200,
    account: {
      paid_user: 1,
      max_upload_file_size: 500 * 1024 * 1024,
      scan_with: "multiscan_paid",
      enforce_private_scan: true,
    },
  });
  assertEquals(r.ready, true);
  assertEquals(r.reason, "ok");
});

Deno.test("evaluateReadiness: never returns raw provider content", () => {
  const r = evaluateReadiness({
    hasApiKey: true,
    hasWorkerSecret: true,
    probeStatus: 200,
    account: {
      paid_user: 1,
      max_upload_file_size: 500 * 1024 * 1024,
      scan_with: "engines",
      enforce_private_scan: true,
      nickname: "SECRET_NICK",
      organization_id: "SECRET_ORG",
      allowed_ips: ["1.2.3.4"],
    },
  });
  const keys = Object.keys(r);
  assertEquals(
    keys.sort().join(","),
    "configured,license_ready,max_upload_mb,private_scan_enforced,ready,reason",
  );
});

// -------------------------- provider response normalization --------------------------

Deno.test("normalizeProviderResponse: pending progress", () => {
  const raw = { scan_results: { scan_all_result_i: 255, progress_percentage: 42 } };
  const n = normalizeProviderResponse(raw);
  assertEquals(n.status, "pending");
  assertEquals(n.summary.progress, 42);
  assertEquals(n.summary.code, 255);
});

Deno.test("normalizeProviderResponse: clean terminal", () => {
  const raw = {
    scan_results: {
      scan_all_result_i: 0,
      progress_percentage: 100,
      total_avs: 32,
      total_detected_avs: 0,
      end_time: "2026-07-24T00:00:00Z",
    },
  };
  const n = normalizeProviderResponse(raw);
  assertEquals(n.status, "clean");
  assertEquals(n.summary.total_engines, 32);
  assertEquals(n.summary.detected_engines, 0);
  assertEquals(n.summary.completed_at, "2026-07-24T00:00:00Z");
});

Deno.test("normalizeProviderResponse: malicious with detection count", () => {
  const raw = {
    scan_results: {
      scan_all_result_i: 1,
      progress_percentage: 100,
      total_avs: 40,
      total_detected_avs: 5,
    },
  };
  const n = normalizeProviderResponse(raw);
  assertEquals(n.status, "malicious");
  assertEquals(n.summary.detected_engines, 5);
});

Deno.test("normalizeProviderResponse: redacts unknown fields", () => {
  const raw = {
    scan_results: { scan_all_result_i: 0, progress_percentage: 100 },
    data_id: "secret-data-id",
    file_info: { sha256: "aaaa" },
    original_filename: "internal.zip",
  };
  const n = normalizeProviderResponse(raw);
  const keys = Object.keys(n.summary).sort();
  assertEquals(
    keys.join(","),
    "code,completed_at,detected_engines,error_code,error_message,progress,total_engines",
  );
});

Deno.test("normalizeProviderResponse: sanitizes error message", () => {
  const raw = {
    scan_results: { scan_all_result_i: 253, progress_percentage: 100 },
    error: { code: "429000", messages: "Rate limit\nexceeded\t— retry later" },
  };
  const n = normalizeProviderResponse(raw);
  assertEquals(n.status, "failed");
  assertEquals(n.summary.error_code, "429000");
  assertEquals(n.summary.error_message, "Rate limit exceeded  retry later");
});

Deno.test("sanitizeErrorMessage: strips control chars and caps length", () => {
  const long = "A".repeat(500);
  const s = sanitizeErrorMessage(long);
  assertEquals(s.length, 200);
});

// -------------------------- constant-time / checksum helpers --------------------------

Deno.test("constantTimeEqual: equal", () => {
  assert(constantTimeEqual("abc123", "abc123"));
});

Deno.test("constantTimeEqual: different lengths", () => {
  assertStrictEquals(constantTimeEqual("abc", "abcd"), false);
});

Deno.test("constantTimeEqual: different content", () => {
  assertStrictEquals(constantTimeEqual("aaaaaa", "aaaaab"), false);
});

Deno.test("bytesEqualConstantTime: length mismatch", () => {
  assertStrictEquals(
    bytesEqualConstantTime(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2])),
    false,
  );
});

Deno.test("bytesEqualConstantTime: exact match", () => {
  assert(
    bytesEqualConstantTime(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])),
  );
});

Deno.test("bytesEqualConstantTime: single-byte diff", () => {
  assertStrictEquals(
    bytesEqualConstantTime(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])),
    false,
  );
});

Deno.test("normalizeHexChecksum: strips prefix and lowercases", () => {
  assertEquals(normalizeHexChecksum("SHA256:ABC123def"), "abc123def");
  assertEquals(normalizeHexChecksum("  ABCDEF01  "), "abcdef01");
});

Deno.test("normalizeHexChecksum: rejects non-hex", () => {
  assertEquals(normalizeHexChecksum("not-hex-zzz"), null);
  assertEquals(normalizeHexChecksum(""), null);
  assertEquals(normalizeHexChecksum(null), null);
});

Deno.test("sha256Hex: matches known vector for empty and 'abc'", async () => {
  assertEquals(
    await sha256Hex(new Uint8Array()),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assertEquals(
    await sha256Hex(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

// -------------------------- misc --------------------------

Deno.test("nextPollDelayMs: monotonic then capped", () => {
  const d0 = nextPollDelayMs(0);
  const d3 = nextPollDelayMs(3);
  const d99 = nextPollDelayMs(99);
  assert(d0 >= 10_000 && d0 < 12_000);
  assert(d3 >= 80_000 && d3 < 90_000);
  assert(d99 <= 5 * 60_000 + 1000);
});

Deno.test("sanitizeFileName: strips path and unsafe chars", () => {
  assertEquals(sanitizeFileName("../../etc/passwd"), "passwd");
  assertEquals(sanitizeFileName("weird name!@#.zip"), "weird_name___.zip");
  assertEquals(sanitizeFileName(""), "file");
});

// ------------------------- readiness persistence decision -------------------------

Deno.test("decideReadinessPersistence: ok -> proceed", () => {
  assertEquals(decideReadinessPersistence("ok"), "proceed");
});

Deno.test("decideReadinessPersistence: provider_unreachable -> retry", () => {
  assertEquals(decideReadinessPersistence("provider_unreachable"), "retry");
});

Deno.test("decideReadinessPersistence: license/privacy/auth reasons -> fail_now", () => {
  const reasons = [
    "no_api_key",
    "no_worker_secret",
    "provider_unauthorized",
    "not_paid_account",
    "upload_size_too_small",
    "no_scan_engines",
    "private_scan_not_enforced",
  ] as const;
  for (const r of reasons) {
    assertEquals(decideReadinessPersistence(r), "fail_now", `reason ${r}`);
  }
});

// ------------------------- mandatory integrity metadata -------------------------

Deno.test("validateIntegrityMetadata: happy path 64-hex checksum + integer size", () => {
  const hex = "a".repeat(64);
  const r = validateIntegrityMetadata({ size_bytes: 100, checksum_sha256: hex });
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.size, 100);
    assertEquals(r.checksumHex, hex);
  }
});

Deno.test("validateIntegrityMetadata: both missing", () => {
  const r = validateIntegrityMetadata({ size_bytes: null, checksum_sha256: null });
  assertStrictEquals(r.ok, false);
  if (!r.ok) assertEquals(r.reason, "integrity_metadata_missing");
});

Deno.test("validateIntegrityMetadata: size missing", () => {
  const r = validateIntegrityMetadata({
    size_bytes: null,
    checksum_sha256: "a".repeat(64),
  });
  assertStrictEquals(r.ok, false);
  if (!r.ok) assertEquals(r.reason, "integrity_metadata_missing");
});

Deno.test("validateIntegrityMetadata: checksum missing", () => {
  const r = validateIntegrityMetadata({ size_bytes: 10, checksum_sha256: null });
  assertStrictEquals(r.ok, false);
  if (!r.ok) assertEquals(r.reason, "integrity_metadata_missing");
});

Deno.test("validateIntegrityMetadata: negative or non-integer size invalid", () => {
  const hex = "a".repeat(64);
  const neg = validateIntegrityMetadata({ size_bytes: -1, checksum_sha256: hex });
  assertStrictEquals(neg.ok, false);
  if (!neg.ok) assertEquals(neg.reason, "integrity_size_invalid");
  const frac = validateIntegrityMetadata({ size_bytes: 1.5, checksum_sha256: hex });
  assertStrictEquals(frac.ok, false);
  if (!frac.ok) assertEquals(frac.reason, "integrity_size_invalid");
});

Deno.test("validateIntegrityMetadata: NaN/Infinity size invalid", () => {
  const hex = "a".repeat(64);
  const nan = validateIntegrityMetadata({ size_bytes: Number.NaN, checksum_sha256: hex });
  assertStrictEquals(nan.ok, false);
  if (!nan.ok) assertEquals(nan.reason, "integrity_size_invalid");
});

Deno.test("validateIntegrityMetadata: checksum wrong length rejected", () => {
  const short = validateIntegrityMetadata({ size_bytes: 1, checksum_sha256: "abcd" });
  assertStrictEquals(short.ok, false);
  if (!short.ok) assertEquals(short.reason, "integrity_checksum_invalid");
  const long = validateIntegrityMetadata({ size_bytes: 1, checksum_sha256: "a".repeat(65) });
  assertStrictEquals(long.ok, false);
  if (!long.ok) assertEquals(long.reason, "integrity_checksum_invalid");
});

Deno.test("validateIntegrityMetadata: checksum non-hex rejected", () => {
  const r = validateIntegrityMetadata({
    size_bytes: 1,
    checksum_sha256: "z".repeat(64),
  });
  assertStrictEquals(r.ok, false);
  if (!r.ok) assertEquals(r.reason, "integrity_checksum_invalid");
});

Deno.test("validateIntegrityMetadata: SHA256: prefix accepted", () => {
  const hex = "b".repeat(64);
  const r = validateIntegrityMetadata({
    size_bytes: 5,
    checksum_sha256: `SHA256:${hex.toUpperCase()}`,
  });
  assert(r.ok);
  if (r.ok) assertEquals(r.checksumHex, hex);
});

// ------------------------- attempt cutoff (>=) -------------------------

Deno.test("shouldStopForAttempts: strict >= MAX_ITEM_ATTEMPTS", () => {
  assertStrictEquals(shouldStopForAttempts(MAX_ITEM_ATTEMPTS - 1), false);
  assertStrictEquals(shouldStopForAttempts(MAX_ITEM_ATTEMPTS), true);
  assertStrictEquals(shouldStopForAttempts(MAX_ITEM_ATTEMPTS + 1), true);
});

Deno.test("shouldStopForAttempts: 0 and 1 do not stop", () => {
  assertStrictEquals(shouldStopForAttempts(0), false);
  assertStrictEquals(shouldStopForAttempts(1), false);
});

// ------------------------- queue admission -------------------------

Deno.test("decideQueueAllowed: unscanned + ready + files -> allow", () => {
  const d = decideQueueAllowed({
    latestScanStatus: null,
    hasAnyPendingChild: false,
    hasFiles: true,
    providerReady: true,
  });
  assertStrictEquals(d.allow, true);
});

Deno.test("decideQueueAllowed: failed latest -> allow", () => {
  const d = decideQueueAllowed({
    latestScanStatus: "failed",
    hasAnyPendingChild: false,
    hasFiles: true,
    providerReady: true,
  });
  assertStrictEquals(d.allow, true);
});

Deno.test("decideQueueAllowed: clean/suspicious/malicious latest -> already_clean", () => {
  for (const s of ["clean", "suspicious", "malicious"] as const) {
    const d = decideQueueAllowed({
      latestScanStatus: s,
      hasAnyPendingChild: false,
      hasFiles: true,
      providerReady: true,
    });
    assertStrictEquals(d.allow, false);
    if (!d.allow) assertEquals(d.reason, "already_clean", `state ${s}`);
  }
});

Deno.test("decideQueueAllowed: pending latest -> pending_exists", () => {
  const d = decideQueueAllowed({
    latestScanStatus: "pending",
    hasAnyPendingChild: false,
    hasFiles: true,
    providerReady: true,
  });
  assertStrictEquals(d.allow, false);
  if (!d.allow) assertEquals(d.reason, "pending_exists");
});

Deno.test("decideQueueAllowed: pending child under terminal aggregate blocks queue", () => {
  const d = decideQueueAllowed({
    latestScanStatus: "malicious",
    hasAnyPendingChild: true,
    hasFiles: true,
    providerReady: true,
  });
  assertStrictEquals(d.allow, false);
  if (!d.allow) assertEquals(d.reason, "pending_exists");
});

Deno.test("decideQueueAllowed: not ready blocks first (no_files still hidden)", () => {
  const d = decideQueueAllowed({
    latestScanStatus: null,
    hasAnyPendingChild: false,
    hasFiles: false,
    providerReady: false,
  });
  assertStrictEquals(d.allow, false);
  if (!d.allow) assertEquals(d.reason, "not_ready");
});

Deno.test("decideQueueAllowed: no files when ready -> no_files", () => {
  const d = decideQueueAllowed({
    latestScanStatus: null,
    hasAnyPendingChild: false,
    hasFiles: false,
    providerReady: true,
  });
  assertStrictEquals(d.allow, false);
  if (!d.allow) assertEquals(d.reason, "no_files");
});

// ------------------------- refresh admission -------------------------

Deno.test("decideRefreshAllowed: scan missing -> scan_not_found", () => {
  const d = decideRefreshAllowed({ scanExists: false, pendingItemCount: 5 });
  assertStrictEquals(d.allow, false);
  if (!d.allow) assertEquals(d.reason, "scan_not_found");
});

Deno.test("decideRefreshAllowed: pending child under terminal aggregate is refreshable", () => {
  const d = decideRefreshAllowed({ scanExists: true, pendingItemCount: 1 });
  assertStrictEquals(d.allow, true);
});

Deno.test("decideRefreshAllowed: zero pending children -> scan_not_pending", () => {
  const d = decideRefreshAllowed({ scanExists: true, pendingItemCount: 0 });
  assertStrictEquals(d.allow, false);
  if (!d.allow) assertEquals(d.reason, "scan_not_pending");
});

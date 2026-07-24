import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  constantTimeEqual,
  evaluateReadiness,
  mapResultCode,
  nextPollDelayMs,
  normalizeProviderResponse,
  sanitizeErrorMessage,
  sanitizeFileName,
} from "./metadefender.ts";

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

Deno.test("mapResultCode: null code with progress=100 pending", () => {
  assertEquals(mapResultCode(null, 100), "pending");
});

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

Deno.test("constantTimeEqual: equal", () => {
  assert(constantTimeEqual("abc123", "abc123"));
});

Deno.test("constantTimeEqual: different lengths", () => {
  assertStrictEquals(constantTimeEqual("abc", "abcd"), false);
});

Deno.test("constantTimeEqual: different content", () => {
  assertStrictEquals(constantTimeEqual("aaaaaa", "aaaaab"), false);
});

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

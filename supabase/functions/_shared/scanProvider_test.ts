import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  aggregateItemStatuses,
  BLOCKED_RISK_FLAGS,
  bytesEqualConstantTime,
  classifyHttpStatus,
  CLOUDMERSIVE_POLICY_HEADERS,
  constantTimeEqual,
  decideQueueAllowed,
  decideReadinessPersistence,
  decideRefreshAllowed,
  evaluateReadiness,
  MAX_ITEM_ATTEMPTS,
  mapAdvancedScanBody,
  nextPollDelayMs,
  normalizeHexChecksum,
  resolveItemStatus,
  sanitizeFileName,
  SCANNER_NAME,
  sha256Hex,
  shouldStopForAttempts,
  validateIntegrityMetadata,
} from "./scanProvider.ts";

// -------- constants / policy --------

Deno.test("scanner name is cloudmersive", () => {
  assertEquals(SCANNER_NAME, "cloudmersive");
});

Deno.test("policy headers: code allowed, hidden risks fail closed", () => {
  const h = CLOUDMERSIVE_POLICY_HEADERS;
  assertEquals(h.allowExecutables, "true");
  assertEquals(h.allowScripts, "true");
  assertEquals(h.allowHtml, "true");
  assertEquals(h.allowInvalidFiles, "false");
  assertEquals(h.allowPasswordProtectedFiles, "false");
  assertEquals(h.allowMacros, "false");
  assertEquals(h.allowXmlExternalEntities, "false");
  assertEquals(h.allowInsecureDeserialization, "false");
  assertEquals(h.allowUnsafeArchives, "false");
  assertEquals(h.allowOleEmbeddedObject, "false");
  assertEquals(h.allowUnwantedAction, "false");
  // No restrictFileTypes key.
  assertStrictEquals((h as Record<string, unknown>).restrictFileTypes, undefined);
});

// -------- HTTP classification --------

Deno.test("classifyHttpStatus: 200 -> ok", () => {
  assertEquals(classifyHttpStatus(200).kind, "ok");
});

Deno.test("classifyHttpStatus: 401/403 -> terminal provider_unauthorized", () => {
  for (const s of [401, 403]) {
    const r = classifyHttpStatus(s);
    assertEquals(r.kind, "terminal");
    if (r.kind === "terminal") assertEquals(r.reason, "provider_unauthorized");
  }
});

Deno.test("classifyHttpStatus: 413 -> terminal provider_file_too_large", () => {
  const r = classifyHttpStatus(413);
  assertEquals(r.kind, "terminal");
  if (r.kind === "terminal") assertEquals(r.reason, "provider_file_too_large");
});

Deno.test("classifyHttpStatus: 429/408/0/5xx -> transient", () => {
  for (const s of [0, 408, 429, 500, 502, 503, 504]) {
    const r = classifyHttpStatus(s);
    assertEquals(r.kind, "transient", `status ${s}`);
    if (r.kind === "transient") assertEquals(r.reason, "provider_transient");
  }
});

Deno.test("classifyHttpStatus: other 4xx -> terminal provider_rejected", () => {
  for (const s of [400, 402, 404, 415, 422]) {
    const r = classifyHttpStatus(s);
    assertEquals(r.kind, "terminal", `status ${s}`);
    if (r.kind === "terminal") assertEquals(r.reason, "provider_rejected");
  }
});

// -------- Body mapping --------

Deno.test("mapAdvancedScanBody: CleanResult true -> clean, ContainsScript is informational", () => {
  const r = mapAdvancedScanBody({
    CleanResult: true,
    ContainsScript: true,
    ContainsExecutable: true,
    ContainsHtml: true,
    VerifiedFileFormat: "zip",
  });
  assertEquals(r.status, "clean");
  assertEquals(r.summary.contains_script, true);
  assertEquals(r.summary.contains_executable, true);
  assertEquals(r.summary.contains_html, true);
  assertEquals(r.summary.verified_format, "zip");
  assertStrictEquals(r.transient, false);
});

Deno.test("mapAdvancedScanBody: CleanResult false with viruses -> malicious", () => {
  const r = mapAdvancedScanBody({
    CleanResult: false,
    FoundViruses: [{ VirusName: "Eicar-Test" }, { VirusName: "X" }],
  });
  assertEquals(r.status, "malicious");
  assertEquals(r.summary.virus_count, 2);
  assertEquals(r.summary.virus_names, ["Eicar-Test", "X"]);
  assertEquals(r.reason, "virus_found");
});

Deno.test("mapAdvancedScanBody: CleanResult false + blocked flag -> suspicious", () => {
  const r = mapAdvancedScanBody({
    CleanResult: false,
    ContainsMacros: true,
  });
  assertEquals(r.status, "suspicious");
  assertEquals(r.summary.blocked_flags, ["ContainsMacros"]);
  assertEquals(r.reason, "blocked:ContainsMacros");
});

Deno.test("mapAdvancedScanBody: every blocked risk flag recognized", () => {
  for (const flag of BLOCKED_RISK_FLAGS) {
    const r = mapAdvancedScanBody({ CleanResult: false, [flag]: true });
    assertEquals(r.status, "suspicious", `flag ${flag}`);
    assert(r.summary.blocked_flags.includes(flag), `flag ${flag} listed`);
  }
});

Deno.test("mapAdvancedScanBody: CleanResult false with no viruses/flags -> failed", () => {
  const r = mapAdvancedScanBody({ CleanResult: false });
  assertEquals(r.status, "failed");
  assertEquals(r.summary.reason_code, "not_clean_no_reason");
  assertStrictEquals(r.transient, false);
});

Deno.test("mapAdvancedScanBody: malformed / missing CleanResult -> failed", () => {
  const cases: unknown[] = [null, undefined, "x", 42, {}, { CleanResult: "yes" }];
  for (const c of cases) {
    const r = mapAdvancedScanBody(c);
    assertEquals(r.status, "failed", `case ${JSON.stringify(c)}`);
    assertEquals(r.summary.reason_code, "malformed_response");
    assertEquals(r.reason, "malformed_response");
  }
});

Deno.test("mapAdvancedScanBody: virus names bounded and ASCII-sanitized", () => {
  const many = Array.from({ length: 100 }, (_, i) => ({
    VirusName: `Virus\n\t${i}\u0000\u00e9`,
  }));
  const r = mapAdvancedScanBody({ CleanResult: false, FoundViruses: many });
  assertEquals(r.status, "malicious");
  assertEquals(r.summary.virus_names.length, 20); // MAX_VIRUS_NAMES
  for (const n of r.summary.virus_names) {
    assert(/^[\x20-\x7E]+$/.test(n), `ascii only: ${n}`);
    assert(n.length <= 120);
    assert(!n.includes("\u00e9"));
  }
});

Deno.test("mapAdvancedScanBody: does not surface unknown provider fields", () => {
  const r = mapAdvancedScanBody({
    CleanResult: true,
    AccountEmail: "leak@example.com",
    ApiKeyId: "key_123",
    _debug: { path: "/tmp/x" },
  });
  const keys = Object.keys(r.summary).sort().join(",");
  assertEquals(
    keys,
    "blocked_flags,clean_result,contains_executable,contains_html,contains_script,reason_code,verified_format,virus_count,virus_names",
  );
});

// -------- Readiness --------

Deno.test("evaluateReadiness: no api key -> no_api_key", () => {
  const r = evaluateReadiness({ hasApiKey: false, hasWorkerSecret: true });
  assertEquals(r.reason, "no_api_key");
  assertEquals(r.configured, false);
  assertEquals(r.ready, false);
});

Deno.test("evaluateReadiness: no worker secret -> no_worker_secret", () => {
  const r = evaluateReadiness({ hasApiKey: true, hasWorkerSecret: false });
  assertEquals(r.reason, "no_worker_secret");
  assertEquals(r.configured, false);
});

Deno.test("evaluateReadiness: both secrets -> ok/configured/ready", () => {
  const r = evaluateReadiness({ hasApiKey: true, hasWorkerSecret: true });
  assertEquals(r.reason, "ok");
  assertEquals(r.configured, true);
  assertEquals(r.ready, true);
});

Deno.test("decideReadinessPersistence: ok proceeds, everything else fails now", () => {
  assertEquals(decideReadinessPersistence("ok"), "proceed");
  assertEquals(decideReadinessPersistence("no_api_key"), "fail_now");
  assertEquals(decideReadinessPersistence("no_worker_secret"), "fail_now");
});

// -------- Item precedence / aggregate --------

Deno.test("resolveItemStatus: never downgrades stronger signals", () => {
  assertEquals(resolveItemStatus("clean", "pending"), "clean");
  assertEquals(resolveItemStatus("failed", "pending"), "failed");
  assertEquals(resolveItemStatus("malicious", "clean"), "malicious");
  assertEquals(resolveItemStatus("suspicious", "failed"), "suspicious");
});

Deno.test("resolveItemStatus: stronger upgrades", () => {
  assertEquals(resolveItemStatus("failed", "clean"), "clean");
  assertEquals(resolveItemStatus("clean", "suspicious"), "suspicious");
  assertEquals(resolveItemStatus("clean", "malicious"), "malicious");
  assertEquals(resolveItemStatus("pending", "clean"), "clean");
});

Deno.test("aggregateItemStatuses: precedence", () => {
  assertEquals(aggregateItemStatuses([]), "pending");
  assertEquals(aggregateItemStatuses(["clean", "malicious", "failed"]), "malicious");
  assertEquals(aggregateItemStatuses(["clean", "suspicious", "failed"]), "suspicious");
  assertEquals(aggregateItemStatuses(["clean", "failed"]), "failed");
  assertEquals(aggregateItemStatuses(["clean", "clean"]), "clean");
  assertEquals(aggregateItemStatuses(["clean", "pending"]), "pending");
});

// -------- Integrity + attempts --------

Deno.test("validateIntegrityMetadata: happy path", () => {
  const hex = "a".repeat(64);
  const r = validateIntegrityMetadata({ size_bytes: 10, checksum_sha256: hex });
  assert(r.ok);
  if (r.ok) assertEquals(r.checksumHex, hex);
});

Deno.test("validateIntegrityMetadata: rejects missing/invalid", () => {
  const hex = "a".repeat(64);
  assertStrictEquals(
    validateIntegrityMetadata({ size_bytes: null, checksum_sha256: hex }).ok,
    false,
  );
  assertStrictEquals(
    validateIntegrityMetadata({ size_bytes: 10, checksum_sha256: null }).ok,
    false,
  );
  const badSize = validateIntegrityMetadata({ size_bytes: -1, checksum_sha256: hex });
  assertStrictEquals(badSize.ok, false);
  if (!badSize.ok) assertEquals(badSize.reason, "integrity_size_invalid");
  const badFrac = validateIntegrityMetadata({ size_bytes: 1.5, checksum_sha256: hex });
  assertStrictEquals(badFrac.ok, false);
  if (!badFrac.ok) assertEquals(badFrac.reason, "integrity_size_invalid");
  const shortHex = validateIntegrityMetadata({ size_bytes: 1, checksum_sha256: "abcd" });
  assertStrictEquals(shortHex.ok, false);
  if (!shortHex.ok) assertEquals(shortHex.reason, "integrity_checksum_invalid");
  const nonHex = validateIntegrityMetadata({ size_bytes: 1, checksum_sha256: "z".repeat(64) });
  assertStrictEquals(nonHex.ok, false);
  if (!nonHex.ok) assertEquals(nonHex.reason, "integrity_checksum_invalid");
});

Deno.test("validateIntegrityMetadata: accepts SHA256: prefix", () => {
  const hex = "b".repeat(64);
  const r = validateIntegrityMetadata({ size_bytes: 1, checksum_sha256: `SHA256:${hex.toUpperCase()}` });
  assert(r.ok);
  if (r.ok) assertEquals(r.checksumHex, hex);
});

Deno.test("shouldStopForAttempts: >= MAX_ITEM_ATTEMPTS", () => {
  assertStrictEquals(shouldStopForAttempts(MAX_ITEM_ATTEMPTS - 1), false);
  assertStrictEquals(shouldStopForAttempts(MAX_ITEM_ATTEMPTS), true);
  assertStrictEquals(shouldStopForAttempts(MAX_ITEM_ATTEMPTS + 1), true);
});

// -------- Queue / refresh admission --------

Deno.test("decideQueueAllowed: unscanned + ready + files -> allow", () => {
  const d = decideQueueAllowed({
    latestScanStatus: null,
    hasAnyPendingChild: false,
    hasFiles: true,
    providerReady: true,
  });
  assertStrictEquals(d.allow, true);
});

Deno.test("decideQueueAllowed: not_ready wins over other blockers", () => {
  const d = decideQueueAllowed({
    latestScanStatus: null,
    hasAnyPendingChild: true,
    hasFiles: false,
    providerReady: false,
  });
  assertStrictEquals(d.allow, false);
  if (!d.allow) assertEquals(d.reason, "not_ready");
});

Deno.test("decideQueueAllowed: no files -> no_files", () => {
  const d = decideQueueAllowed({
    latestScanStatus: null,
    hasAnyPendingChild: false,
    hasFiles: false,
    providerReady: true,
  });
  assertStrictEquals(d.allow, false);
  if (!d.allow) assertEquals(d.reason, "no_files");
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

Deno.test("decideQueueAllowed: clean/suspicious/malicious latest -> already_clean", () => {
  for (const s of ["clean", "suspicious", "malicious"] as const) {
    const d = decideQueueAllowed({
      latestScanStatus: s,
      hasAnyPendingChild: false,
      hasFiles: true,
      providerReady: true,
    });
    assertStrictEquals(d.allow, false);
    if (!d.allow) assertEquals(d.reason, "already_clean");
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

Deno.test("decideRefreshAllowed: gated on existence and pending count", () => {
  assertStrictEquals(
    decideRefreshAllowed({ scanExists: false, pendingItemCount: 5 }).allow,
    false,
  );
  const r1 = decideRefreshAllowed({ scanExists: true, pendingItemCount: 0 });
  assertStrictEquals(r1.allow, false);
  if (!r1.allow) assertEquals(r1.reason, "scan_not_pending");
  assertStrictEquals(
    decideRefreshAllowed({ scanExists: true, pendingItemCount: 1 }).allow,
    true,
  );
});

// -------- Constant-time / checksum helpers --------

Deno.test("constantTimeEqual", () => {
  assert(constantTimeEqual("abc", "abc"));
  assertStrictEquals(constantTimeEqual("abc", "abcd"), false);
  assertStrictEquals(constantTimeEqual("aaaaaa", "aaaaab"), false);
});

Deno.test("bytesEqualConstantTime", () => {
  assert(bytesEqualConstantTime(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])));
  assertStrictEquals(
    bytesEqualConstantTime(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2])),
    false,
  );
});

Deno.test("normalizeHexChecksum", () => {
  assertEquals(normalizeHexChecksum("SHA256:ABCDEF01"), "abcdef01");
  assertEquals(normalizeHexChecksum("  DEADbeef  "), "deadbeef");
  assertEquals(normalizeHexChecksum(""), null);
  assertEquals(normalizeHexChecksum("xyz"), null);
});

Deno.test("sha256Hex known vectors", async () => {
  assertEquals(
    await sha256Hex(new Uint8Array()),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assertEquals(
    await sha256Hex(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

Deno.test("sanitizeFileName strips path and unsafe chars", () => {
  assertEquals(sanitizeFileName("../../etc/passwd"), "passwd");
  assertEquals(sanitizeFileName("weird name!@#.zip"), "weird_name___.zip");
  assertEquals(sanitizeFileName(""), "file");
});

Deno.test("nextPollDelayMs: monotonic then capped", () => {
  const d0 = nextPollDelayMs(0);
  const d3 = nextPollDelayMs(3);
  const d99 = nextPollDelayMs(99);
  assert(d0 >= 10_000 && d0 < 12_000);
  assert(d3 >= 80_000 && d3 < 90_000);
  assert(d99 <= 5 * 60_000 + 1000);
});

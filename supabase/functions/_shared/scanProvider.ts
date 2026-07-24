// Cloudmersive Virus Scan (advanced) shared helpers.
// No network calls at module scope; no logging of secrets, bucket/path,
// signed URLs, raw response bodies, file bytes, checksums, or provider text.
// All exported helpers are dependency-free and unit-tested.

export const CLOUDMERSIVE_ADVANCED_SCAN_URL =
  "https://api.cloudmersive.com/virus/scan/file/advanced";
export const SCANNER_NAME = "cloudmersive";
export const RESOURCE_PACKAGES_BUCKET = "resource-packages";
export const MAX_ITEM_ATTEMPTS = 12;

// Locked policy headers. Code-based skills allowed (executables/scripts/html)
// but hidden-risk categories fail closed.
export const CLOUDMERSIVE_POLICY_HEADERS = Object.freeze({
  allowExecutables: "true",
  allowScripts: "true",
  allowHtml: "true",
  allowInvalidFiles: "false",
  allowPasswordProtectedFiles: "false",
  allowMacros: "false",
  allowXmlExternalEntities: "false",
  allowInsecureDeserialization: "false",
  allowUnsafeArchives: "false",
  allowOleEmbeddedObject: "false",
  allowUnwantedAction: "false",
});

// Blocked-risk flags. Any true flag on a not-clean response with no viruses
// escalates to `suspicious`.
export const BLOCKED_RISK_FLAGS = [
  "ContainsInvalidFile",
  "ContainsPasswordProtectedFile",
  "ContainsRestrictedFileFormat",
  "ContainsMacros",
  "ContainsXmlExternalEntities",
  "ContainsInsecureDeserialization",
  "ContainsUnsafeArchive",
  "ContainsOleEmbeddedObject",
  "ContainsUnwantedAction",
] as const;

export type NormalizedStatus =
  | "pending"
  | "clean"
  | "suspicious"
  | "malicious"
  | "failed";

// ------------------------- Item / aggregate precedence -------------------------

const ITEM_RANK: Record<NormalizedStatus, number> = {
  malicious: 4,
  suspicious: 3,
  clean: 2,
  failed: 1,
  pending: 0,
};

export function resolveItemStatus(
  current: NormalizedStatus,
  incoming: NormalizedStatus,
): NormalizedStatus {
  return ITEM_RANK[incoming] > ITEM_RANK[current] ? incoming : current;
}

// malicious > suspicious > failed > (clean iff every item clean) > pending.
export function aggregateItemStatuses(
  statuses: readonly NormalizedStatus[],
): NormalizedStatus {
  if (statuses.length === 0) return "pending";
  if (statuses.some((s) => s === "malicious")) return "malicious";
  if (statuses.some((s) => s === "suspicious")) return "suspicious";
  if (statuses.some((s) => s === "failed")) return "failed";
  if (statuses.every((s) => s === "clean")) return "clean";
  return "pending";
}

// ------------------------- Readiness (configuration-only) -------------------------

// Cloudmersive readiness is credentials-only. Validity is only verified on the
// first real scan — no probe request is made here to avoid consuming API
// calls.
export type ReadinessReason = "ok" | "no_api_key" | "no_worker_secret";

export interface ReadinessResult {
  configured: boolean;
  ready: boolean;
  reason: ReadinessReason;
}

export function evaluateReadiness(input: {
  hasApiKey: boolean;
  hasWorkerSecret: boolean;
}): ReadinessResult {
  if (!input.hasApiKey) {
    return { configured: false, ready: false, reason: "no_api_key" };
  }
  if (!input.hasWorkerSecret) {
    return { configured: false, ready: false, reason: "no_worker_secret" };
  }
  return { configured: true, ready: true, reason: "ok" };
}

// Worker persistence decision from a readiness reason encountered before I/O.
// Cloudmersive readiness is purely local (env presence), so any not-ok reason
// is a hard operator action and must fail affected items now.
export type ReadinessPersistenceDecision = "proceed" | "retry" | "fail_now";

export function decideReadinessPersistence(
  reason: ReadinessReason,
): ReadinessPersistenceDecision {
  if (reason === "ok") return "proceed";
  return "fail_now";
}

// ------------------------- Cloudmersive response mapping -------------------------

export interface SafeScanSummary {
  clean_result: boolean | null;
  verified_format: string | null; // sanitized
  virus_count: number;
  virus_names: string[]; // sanitized, bounded
  blocked_flags: string[]; // subset of BLOCKED_RISK_FLAGS
  contains_script: boolean;
  contains_executable: boolean;
  contains_html: boolean;
  reason_code: string | null; // e.g. "malformed_response"
}

export interface MappedScanResult {
  status: NormalizedStatus;
  summary: SafeScanSummary;
  // When status === "pending", callers retry (transient).
  transient: boolean;
  // Stable safe reason to record in last_error_code / findings.reason.
  reason: string;
}

const MAX_VIRUS_NAMES = 20;
const MAX_VIRUS_NAME_LEN = 120;
const MAX_VERIFIED_FORMAT_LEN = 40;

function sanitizeAscii(s: unknown, maxLen: number): string {
  const raw = typeof s === "string" ? s : "";
  const cleaned = raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

function bool(o: unknown, key: string): boolean {
  if (!o || typeof o !== "object") return false;
  const v = (o as Record<string, unknown>)[key];
  return v === true;
}

function emptySummary(): SafeScanSummary {
  return {
    clean_result: null,
    verified_format: null,
    virus_count: 0,
    virus_names: [],
    blocked_flags: [],
    contains_script: false,
    contains_executable: false,
    contains_html: false,
    reason_code: null,
  };
}

// Classify HTTP status only. Body may or may not be present.
export type HttpClassification =
  | { kind: "ok" } // 200 → hand body to mapAdvancedScanBody
  | { kind: "terminal"; reason: "provider_unauthorized" | "provider_file_too_large" | "provider_rejected" }
  | { kind: "transient"; reason: "provider_transient" };

export function classifyHttpStatus(status: number): HttpClassification {
  if (status === 200) return { kind: "ok" };
  if (status === 401 || status === 403) {
    return { kind: "terminal", reason: "provider_unauthorized" };
  }
  if (status === 413) {
    return { kind: "terminal", reason: "provider_file_too_large" };
  }
  // Transient: network/timeout (0), 408, 429, 5xx.
  if (status === 0 || status === 408 || status === 429 || status >= 500) {
    return { kind: "transient", reason: "provider_transient" };
  }
  // Other 4xx.
  return { kind: "terminal", reason: "provider_rejected" };
}

// Parse the 200 body into a fail-closed normalized status.
export function mapAdvancedScanBody(body: unknown): MappedScanResult {
  const summary = emptySummary();
  if (!body || typeof body !== "object") {
    summary.reason_code = "malformed_response";
    return { status: "failed", summary, transient: false, reason: "malformed_response" };
  }
  const b = body as Record<string, unknown>;

  const cleanRaw = b["CleanResult"];
  const clean = cleanRaw === true ? true : cleanRaw === false ? false : null;
  summary.clean_result = clean;

  const verified = sanitizeAscii(b["VerifiedFileFormat"], MAX_VERIFIED_FORMAT_LEN);
  summary.verified_format = verified.length > 0 ? verified : null;

  summary.contains_script = bool(b, "ContainsScript");
  summary.contains_executable = bool(b, "ContainsExecutable");
  summary.contains_html = bool(b, "ContainsHtml");

  const virusesRaw = Array.isArray(b["FoundViruses"]) ? (b["FoundViruses"] as unknown[]) : [];
  // Bound the number of provider entries we examine at all. `virus_count`
  // reflects examined entries (even malformed/blank ones) so a non-empty
  // provider array can never be silently dropped. `virus_names` only holds
  // sanitized non-empty labels, and raw entries are never persisted.
  const examined = virusesRaw.slice(0, MAX_VIRUS_NAMES);
  const virusNames: string[] = [];
  for (const v of examined) {
    const rec = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const name = sanitizeAscii(rec?.["VirusName"], MAX_VIRUS_NAME_LEN);
    if (name) virusNames.push(name);
  }
  summary.virus_names = virusNames;
  summary.virus_count = examined.length;

  const flags: string[] = [];
  for (const f of BLOCKED_RISK_FLAGS) {
    if (bool(b, f)) flags.push(f);
  }
  summary.blocked_flags = flags;

  // Fail-closed contradiction: any non-empty FoundViruses array is treated as
  // malicious regardless of CleanResult. Provider must not be trusted to
  // reconcile its own contradictory signals.
  if (examined.length > 0) {
    return { status: "malicious", summary, transient: false, reason: "virus_found" };
  }

  // Decisions.
  if (clean === true) {
    return { status: "clean", summary, transient: false, reason: "clean" };
  }
  if (clean === false) {
    if (flags.length > 0) {
      return { status: "suspicious", summary, transient: false, reason: `blocked:${flags[0]}` };
    }
    summary.reason_code = "not_clean_no_reason";
    return { status: "failed", summary, transient: false, reason: "not_clean_no_reason" };
  }
  // CleanResult missing/malformed.
  summary.reason_code = "malformed_response";
  return { status: "failed", summary, transient: false, reason: "malformed_response" };
}

// ------------------------- Constant-time / integrity helpers -------------------------

export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

export function bytesEqualConstantTime(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function normalizeHexChecksum(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const stripped = s.includes(":") ? s.split(":").pop()! : s;
  const lower = stripped.toLowerCase();
  if (!/^[0-9a-f]+$/.test(lower)) return null;
  return lower;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const view = new Uint8Array(digest);
  let out = "";
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out;
}

export type IntegrityValidation =
  | { ok: true; size: number; checksumHex: string }
  | {
      ok: false;
      reason:
        | "integrity_metadata_missing"
        | "integrity_size_invalid"
        | "integrity_checksum_invalid";
    };

export function validateIntegrityMetadata(input: {
  size_bytes: number | null | undefined;
  checksum_sha256: string | null | undefined;
}): IntegrityValidation {
  const sizeGiven = input.size_bytes != null;
  const checksumGiven =
    input.checksum_sha256 != null && String(input.checksum_sha256).trim() !== "";
  if (!sizeGiven) return { ok: false, reason: "integrity_metadata_missing" };
  const size = input.size_bytes as number;
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0 || !Number.isInteger(size)) {
    return { ok: false, reason: "integrity_size_invalid" };
  }
  if (!checksumGiven) return { ok: false, reason: "integrity_metadata_missing" };
  const hex = normalizeHexChecksum(input.checksum_sha256);
  if (!hex || hex.length !== 64) {
    return { ok: false, reason: "integrity_checksum_invalid" };
  }
  return { ok: true, size, checksumHex: hex };
}

export function shouldStopForAttempts(attemptCountAfterClaim: number): boolean {
  return attemptCountAfterClaim >= MAX_ITEM_ATTEMPTS;
}

export function sanitizeFileName(name: string): string {
  const base = (name ?? "").toString().split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_");
  return cleaned.slice(0, 120) || "file";
}

// Exponential backoff with jitter for transient retries. attempt 0 -> ~10s.
export function nextPollDelayMs(attempt: number): number {
  const base = 10_000 * Math.pow(2, Math.max(0, Math.min(attempt, 6)));
  const capped = Math.min(base, 5 * 60_000);
  const jitter = Math.floor(Math.random() * 1000);
  return capped + jitter;
}

// ------------------------- Queue / refresh admission -------------------------

export type QueueAllowedInput = {
  latestScanStatus: NormalizedStatus | null;
  hasAnyPendingChild: boolean;
  hasFiles: boolean;
  providerReady: boolean;
};
export type QueueDecision =
  | { allow: true }
  | { allow: false; reason: "not_ready" | "no_files" | "pending_exists" | "already_clean" };

export function decideQueueAllowed(input: QueueAllowedInput): QueueDecision {
  if (!input.providerReady) return { allow: false, reason: "not_ready" };
  if (!input.hasFiles) return { allow: false, reason: "no_files" };
  if (input.hasAnyPendingChild) return { allow: false, reason: "pending_exists" };
  const s = input.latestScanStatus;
  if (s === "pending") return { allow: false, reason: "pending_exists" };
  if (s === "clean" || s === "suspicious" || s === "malicious") {
    return { allow: false, reason: "already_clean" };
  }
  return { allow: true };
}

export type RefreshDecision =
  | { allow: true }
  | { allow: false; reason: "scan_not_found" | "scan_not_pending" };

export function decideRefreshAllowed(input: {
  scanExists: boolean;
  pendingItemCount: number;
}): RefreshDecision {
  if (!input.scanExists) return { allow: false, reason: "scan_not_found" };
  if (input.pendingItemCount <= 0) return { allow: false, reason: "scan_not_pending" };
  return { allow: true };
}

// MetaDefender Cloud v4 pure helpers.
// No network calls; no logging of secrets/bucket/path/signed URLs/raw bodies.
// All exported helpers are dependency-free and unit-tested.

export const METADEFENDER_BASE = "https://api.metadefender.com/v4";
export const REQUIRED_UPLOAD_MB = 25;
export const SCANNER_NAME = "metadefender_cloud";

// Locked provider result-code mapping.
// 254/255 or progress<100 => pending
// 0 => clean
// 1 => malicious
// 2 => suspicious
// 3, 16, 19, 23, 252, 253, and everything else terminal => failed
export type NormalizedStatus =
  | "pending"
  | "clean"
  | "suspicious"
  | "malicious"
  | "failed";

export const KNOWN_FAILED_CODES = new Set<number>([3, 16, 19, 23, 252, 253]);

export function mapResultCode(
  code: number | null | undefined,
  progressPercent: number | null | undefined,
): NormalizedStatus {
  const progress = typeof progressPercent === "number" ? progressPercent : 0;
  // 254/255 or progress<100 => pending. Everything else is terminal.
  if (code === 254 || code === 255) return "pending";
  if (progress < 100) return "pending";
  if (code === 0) return "clean";
  if (code === 1) return "malicious";
  if (code === 2) return "suspicious";
  if (KNOWN_FAILED_CODES.has(code as number)) return "failed";
  // Unknown terminal codes (including null at progress=100) fail closed.
  return "failed";
}

// Deterministic aggregate precedence for a bag of item statuses.
// malicious > suspicious > failed > (clean iff every item clean) > pending.
// Mirrors the SQL in v2_internal_apply_scan_item_result so we can unit-test it.
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

// Per-item monotonic precedence (higher wins). A weaker or equal incoming
// signal must never downgrade an existing stronger one. Mirrors SQL ranks.
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

// Stable, safe readiness reason codes (never leak provider text).
export type ReadinessReason =
  | "ok"
  | "no_api_key"
  | "no_worker_secret"
  | "provider_unreachable"
  | "provider_unauthorized"
  | "not_paid_account"
  | "upload_size_too_small"
  | "no_scan_engines"
  | "private_scan_not_enforced";

export interface ReadinessInput {
  hasApiKey: boolean;
  hasWorkerSecret: boolean;
  probeStatus?: number; // HTTP status from GET /apikey/
  account?: unknown; // parsed JSON body from GET /apikey/
}

export interface ReadinessResult {
  configured: boolean; // has both secrets
  ready: boolean; // configured AND provider validated
  max_upload_mb: number | null;
  private_scan_enforced: boolean;
  license_ready: boolean;
  reason: ReadinessReason;
}

// Deep-safe number read.
function num(o: unknown, key: string): number | null {
  if (o && typeof o === "object" && key in (o as Record<string, unknown>)) {
    const v = (o as Record<string, unknown>)[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) {
      return Number(v);
    }
  }
  return null;
}

function bool(o: unknown, key: string): boolean {
  if (!o || typeof o !== "object") return false;
  const v = (o as Record<string, unknown>)[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
  return false;
}

function str(o: unknown, key: string): string | null {
  if (!o || typeof o !== "object") return null;
  const v = (o as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  const base: ReadinessResult = {
    configured: input.hasApiKey && input.hasWorkerSecret,
    ready: false,
    max_upload_mb: null,
    private_scan_enforced: false,
    license_ready: false,
    reason: "ok",
  };

  if (!input.hasApiKey) return { ...base, reason: "no_api_key" };
  if (!input.hasWorkerSecret) return { ...base, reason: "no_worker_secret" };

  if (input.probeStatus === 401 || input.probeStatus === 403) {
    return { ...base, reason: "provider_unauthorized" };
  }
  if (input.probeStatus == null || input.probeStatus >= 500) {
    return { ...base, reason: "provider_unreachable" };
  }
  if (input.probeStatus !== 200) {
    return { ...base, reason: "provider_unreachable" };
  }

  const account = input.account;
  // MetaDefender /apikey/ commonly returns { paid_user, max_upload_file_size, scan_with, enforce_private_scan, ... }
  const paid = num(account, "paid_user") === 1 || bool(account, "paid_user");
  const maxUploadBytes = num(account, "max_upload_file_size");
  const maxUploadMb = maxUploadBytes != null
    ? Math.floor(maxUploadBytes / (1024 * 1024))
    : null;
  const scanWith = str(account, "scan_with") ?? "";
  const enforceKey = bool(account, "enforce_private_scan");
  const enforceOrg = bool(
    (account as Record<string, unknown> | undefined)?.["organization"],
    "enforce_private_scan",
  );

  const result: ReadinessResult = {
    ...base,
    license_ready: paid,
    max_upload_mb: maxUploadMb,
    private_scan_enforced: enforceKey || enforceOrg,
  };

  if (!paid) return { ...result, reason: "not_paid_account" };
  if (maxUploadMb == null || maxUploadMb < REQUIRED_UPLOAD_MB) {
    return { ...result, reason: "upload_size_too_small" };
  }
  if (!scanWith || scanWith.toLowerCase() === "none") {
    return { ...result, reason: "no_scan_engines" };
  }
  if (!(enforceKey || enforceOrg)) {
    return { ...result, reason: "private_scan_not_enforced" };
  }

  return { ...result, ready: true, reason: "ok" };
}

// Constant-time equality for worker secret comparison. Never leaks length via
// early return once inputs are the same string length; if lengths differ we
// still walk over the longer length to keep timing consistent.
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

// Redact a raw provider response to a small safe summary.
export interface SafeProviderSummary {
  code: number | null;
  progress: number;
  total_engines: number | null;
  detected_engines: number | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null; // sanitized, ASCII only, <= 200 chars
}

export function normalizeProviderResponse(
  raw: unknown,
): { status: NormalizedStatus; summary: SafeProviderSummary } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const scanResults = (r["scan_results"] ?? {}) as Record<string, unknown>;
  const code = num(scanResults, "scan_all_result_i");
  const progress = num(scanResults, "progress_percentage") ?? 0;
  const totalEngines = num(scanResults, "total_avs");
  const detectedEngines = num(scanResults, "total_detected_avs");
  const completedAt = str(scanResults, "end_time");

  const errObj = (r["error"] ?? null) as Record<string, unknown> | null;
  const errCode = errObj ? str(errObj, "code") : null;
  const errMsgRaw = errObj ? str(errObj, "messages") ?? str(errObj, "message") : null;

  return {
    status: mapResultCode(code, progress),
    summary: {
      code,
      progress: Math.max(0, Math.min(100, Math.round(progress))),
      total_engines: totalEngines,
      detected_engines: detectedEngines,
      completed_at: completedAt,
      error_code: errCode,
      error_message: errMsgRaw ? sanitizeErrorMessage(errMsgRaw) : null,
    },
  };
}

export function sanitizeErrorMessage(s: string): string {
  const cleaned = s
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]/g, "") // ASCII only
    .trim();
  return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned;
}

// Exponential backoff with jitter for the poll cadence.
// attempt 0 -> ~10s, 1 -> ~20s, 2 -> ~40s, capped at 5 minutes.
export function nextPollDelayMs(attempt: number): number {
  const base = 10_000 * Math.pow(2, Math.max(0, Math.min(attempt, 6)));
  const capped = Math.min(base, 5 * 60_000);
  const jitter = Math.floor(Math.random() * 1000);
  return capped + jitter;
}

export const MAX_ITEM_ATTEMPTS = 12;

// Safe file name sanitizer for provider `filename` header.
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_");
  return cleaned.slice(0, 120) || "file";
}

// Byte-array constant-time equality for hex checksums.
export function bytesEqualConstantTime(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Normalize a hex checksum ("SHA256:abc..." | "abc..." | " ABC ") to lowercase hex.
export function normalizeHexChecksum(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const stripped = s.includes(":") ? s.split(":").pop()! : s;
  const lower = stripped.toLowerCase();
  if (!/^[0-9a-f]+$/.test(lower)) return null;
  return lower;
}

// Compute lowercase-hex SHA-256 of bytes using Web Crypto.
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

export const RESOURCE_PACKAGES_BUCKET = "resource-packages";

// Shared readiness probe. Fails closed on any error. Returns a ReadinessResult.
export async function probeMetadefenderReadiness(
  apiKey: string | undefined | null,
  workerSecret: string | undefined | null,
  timeoutMs = 5000,
): Promise<ReadinessResult> {
  if (!apiKey) {
    return evaluateReadiness({ hasApiKey: false, hasWorkerSecret: !!workerSecret });
  }
  if (!workerSecret) {
    return evaluateReadiness({ hasApiKey: true, hasWorkerSecret: false });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${METADEFENDER_BASE}/apikey/`, {
      method: "GET",
      headers: { apikey: apiKey, accept: "application/json" },
      signal: controller.signal,
    });
    let account: unknown = null;
    try { account = await res.json(); } catch { account = null; }
    return evaluateReadiness({
      hasApiKey: true,
      hasWorkerSecret: true,
      probeStatus: res.status,
      account,
    });
  } catch {
    return evaluateReadiness({
      hasApiKey: true,
      hasWorkerSecret: true,
      probeStatus: undefined,
    });
  } finally {
    clearTimeout(timer);
  }
}

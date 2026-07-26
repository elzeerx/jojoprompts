// v2-admin-storage-settings-status
// Admin-only, read-only safe configuration status for the Supabase Storage
// bucket that backs resource package files. Never returns bucket object
// names, storage paths, checksums, findings, or secret material, and never
// performs listing/downloading/signed-URL/scanner calls. Fails closed on
// any malformed bucket metadata or internal RPC data.

import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import {
  corsHeadersFor, jsonResponse, methodGuard, requireAdmin,
} from "../_shared/v2Upayments.ts";

const BUCKET_ID = "resource-packages";
const MAX_UPLOAD_BYTES = 26214400; // exactly 25 MiB
const SIGNED_URL_TTL_SECONDS = 60;

// Canonical approved MIME set (matches the secure uploader). Do not add,
// remove, or reorder without also updating src/lib/v2/admin/storageSettings.
const CANONICAL_APPROVED_MIME_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "text/x-yaml",
  "text/markdown",
  "text/plain",
] as const;

type ScanCounts = {
  clean: number; pending: number; suspicious: number;
  malicious: number; failed: number; unscanned: number;
};

// ---- Strict validators (fail closed; never coerce) ----------------------

function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= 0;
}
function isIsoString(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}
function isIsoOrNull(v: unknown): boolean {
  return v === null || isIsoString(v);
}
function normalizeIsoOrNull(v: unknown): string | null | false {
  if (v === null) return null;
  if (typeof v !== "string") return false;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return false;
  return new Date(t).toISOString();
}

// Strict bucket MIME normalisation: returns string[] | null (empty allowlist)
// | false (malformed — reject entire payload). Never silently drops entries.
function normalizeBucketMime(v: unknown): string[] | null | false {
  if (v === null || v === undefined) return null;
  if (!Array.isArray(v)) return false;
  const out: string[] = [];
  for (const e of v) {
    if (typeof e !== "string") return false;
    if (e.length === 0 || e !== e.trim()) return false;
    if (e.length > 128) return false;
    out.push(e);
  }
  return out;
}

function parseScanCounts(v: unknown): ScanCounts | null {
  if (!v || typeof v !== "object") return null;
  const sc = v as Record<string, unknown>;
  const keys: (keyof ScanCounts)[] = [
    "clean", "pending", "suspicious", "malicious", "failed", "unscanned",
  ];
  const out: Partial<ScanCounts> = {};
  for (const k of keys) {
    const n = sc[k];
    if (!isNonNegInt(n)) return null;
    out[k] = n;
  }
  return out as ScanCounts;
}

interface AggregateResult {
  as_of: string;
  registered_files: number;
  registered_bytes: number;
  checksum_ready_files: number;
  last_registered_at: string | null;
  scan_counts: ScanCounts;
  authorized_24h: number;
  last_authorized_at: string | null;
}

/**
 * Strictly validate the internal RPC result. Any malformed field returns
 * null; the caller must then return `storage_status_unavailable`.
 * Never coerces malformed values to zero and never fabricates timestamps.
 */
export function parseAggregate(input: unknown): AggregateResult | null {
  if (!input || typeof input !== "object") return null;
  const d = input as Record<string, unknown>;

  if (!isIsoString(d.as_of)) return null;
  const as_of = new Date(Date.parse(d.as_of as string)).toISOString();

  if (!isNonNegInt(d.registered_files)) return null;
  if (!isNonNegInt(d.registered_bytes)) return null;
  if (!isNonNegInt(d.checksum_ready_files)) return null;
  const registered_files = d.registered_files;
  const registered_bytes = d.registered_bytes;
  const checksum_ready_files = d.checksum_ready_files;
  if (checksum_ready_files > registered_files) return null;

  const lastRegistered = normalizeIsoOrNull(d.last_registered_at);
  if (lastRegistered === false) return null;

  const scan_counts = parseScanCounts(d.scan_counts);
  if (!scan_counts) return null;
  const scanSum =
    scan_counts.clean + scan_counts.pending + scan_counts.suspicious +
    scan_counts.malicious + scan_counts.failed + scan_counts.unscanned;
  if (scanSum !== registered_files) return null;

  const dl = d.downloads;
  if (!dl || typeof dl !== "object") return null;
  const dlObj = dl as Record<string, unknown>;
  if (!isNonNegInt(dlObj.authorized_24h)) return null;
  const lastAuthorized = normalizeIsoOrNull(dlObj.last_authorized_at);
  if (lastAuthorized === false) return null;

  return {
    as_of,
    registered_files,
    registered_bytes,
    checksum_ready_files,
    last_registered_at: lastRegistered,
    scan_counts,
    authorized_24h: dlObj.authorized_24h,
    last_authorized_at: lastAuthorized,
  };
}

interface BucketMeta {
  present: boolean;
  public: boolean | null;
  file_size_limit_bytes: number | null;
  allowed_mime_types: string[] | null;
}

/**
 * Strictly parse the listBuckets() entry for our bucket. Returns null if
 * the metadata is malformed (e.g., non-string entries in allowed_mime_types);
 * caller must then return `storage_status_unavailable`.
 */
export function parseBucketMeta(b: unknown): BucketMeta | null {
  if (!b) {
    return {
      present: false,
      public: null,
      file_size_limit_bytes: null,
      allowed_mime_types: null,
    };
  }
  if (typeof b !== "object") return null;
  const obj = b as Record<string, unknown>;

  let pub: boolean | null;
  if (obj.public === undefined || obj.public === null) pub = null;
  else if (typeof obj.public === "boolean") pub = obj.public;
  else return null;

  let limit: number | null;
  if (obj.file_size_limit === undefined || obj.file_size_limit === null) limit = null;
  else if (
    typeof obj.file_size_limit === "number" &&
    Number.isFinite(obj.file_size_limit) &&
    Number.isInteger(obj.file_size_limit) &&
    obj.file_size_limit >= 0
  ) limit = obj.file_size_limit;
  else return null;

  const mime = normalizeBucketMime(obj.allowed_mime_types);
  if (mime === false) return null;

  return {
    present: true,
    public: pub,
    file_size_limit_bytes: limit,
    allowed_mime_types: mime,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeadersFor(origin) });
  }
  const g = methodGuard(req, "POST");
  if (g) return g;

  const admin = await requireAdmin(req);
  if ("error" in admin) return admin.error;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !SERVICE) {
    return jsonResponse({ error: "storage_status_unavailable" }, 500, origin);
  }
  const svc = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- Live bucket configuration probe (metadata only) --------------------
  let bucketMeta: BucketMeta;
  try {
    const { data, error } = await svc.storage.listBuckets();
    if (error || !Array.isArray(data)) {
      return jsonResponse({ error: "storage_status_unavailable" }, 502, origin);
    }
    const entry = data.find((x) => (x as { id?: unknown })?.id === BUCKET_ID);
    const parsed = parseBucketMeta(entry);
    if (!parsed) {
      return jsonResponse({ error: "storage_status_unavailable" }, 502, origin);
    }
    bucketMeta = parsed;
  } catch {
    return jsonResponse({ error: "storage_status_unavailable" }, 502, origin);
  }

  // ---- Aggregate registry / scan / downloads via internal RPC -------------
  let agg: AggregateResult;
  try {
    const { data, error } = await svc.rpc(
      "v2_internal_admin_storage_settings_summary" as never,
    );
    if (error) {
      return jsonResponse({ error: "storage_status_unavailable" }, 502, origin);
    }
    const parsed = parseAggregate(data);
    if (!parsed) {
      return jsonResponse({ error: "storage_status_unavailable" }, 502, origin);
    }
    agg = parsed;
  } catch {
    return jsonResponse({ error: "storage_status_unavailable" }, 502, origin);
  }

  const body = {
    provider: "supabase_storage" as const,
    as_of: agg.as_of,
    bucket: {
      id: BUCKET_ID,
      present: bucketMeta.present,
      public: bucketMeta.public,
      file_size_limit_bytes: bucketMeta.file_size_limit_bytes,
      allowed_mime_types: bucketMeta.allowed_mime_types,
    },
    application_contract: {
      admin_upload_service: "v2-admin-upload-resource-file",
      admin_upload_auth: "verify_jwt_admin",
      customer_download_service: "resource-download",
      customer_download_auth: "custom_bearer_and_entitlement_rpc",
      package_scan_control_service: "v2-admin-package-scan-control",
      package_scan_worker_service: "v2-package-scan-worker",
      max_upload_bytes: MAX_UPLOAD_BYTES,
      signed_url_ttl_seconds: SIGNED_URL_TTL_SECONDS,
      approved_mime_types: CANONICAL_APPROVED_MIME_TYPES,
    },
    registry: {
      registered_files: agg.registered_files,
      registered_bytes: agg.registered_bytes,
      checksum_ready_files: agg.checksum_ready_files,
      last_registered_at: agg.last_registered_at,
    },
    scan_counts: agg.scan_counts,
    downloads: {
      authorized_24h: agg.authorized_24h,
      last_authorized_at: agg.last_authorized_at,
    },
    boundaries: {
      bucket_object_existence: "not_checked" as const,
      signed_url_generation: "not_checked" as const,
      storage_quota_capacity: "not_checked" as const,
      service_runtime_health: "not_checked" as const,
    },
  };

  const res = jsonResponse(body, 200, origin);
  res.headers.set("Cache-Control", "no-store");
  return res;
});

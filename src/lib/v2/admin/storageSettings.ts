// Pure presentation + strict runtime validation for the Admin V2 Storage
// settings page. Fail-closed: any malformed field rejects the whole payload.
// Never allow attacker-controlled or unknown fields into the UI model.

export const STORAGE_BUCKET_ID = "resource-packages";
export const STORAGE_MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 26214400
export const STORAGE_SIGNED_URL_TTL_SECONDS = 60;
export const STORAGE_ADMIN_UPLOAD_SERVICE = "v2-admin-upload-resource-file";
export const STORAGE_ADMIN_UPLOAD_AUTH = "verify_jwt_admin";
export const STORAGE_CUSTOMER_DOWNLOAD_SERVICE = "resource-download";
export const STORAGE_CUSTOMER_DOWNLOAD_AUTH = "custom_bearer_and_entitlement_rpc";
export const STORAGE_SCAN_CONTROL_SERVICE = "v2-admin-package-scan-control";
export const STORAGE_SCAN_WORKER_SERVICE = "v2-package-scan-worker";

export type StorageScanCounts = {
  clean: number;
  pending: number;
  suspicious: number;
  malicious: number;
  failed: number;
  unscanned: number;
};

export type StorageSettingsStatus = {
  provider: "supabase_storage";
  as_of: string;
  bucket: {
    id: "resource-packages";
    present: boolean;
    public: boolean | null;
    file_size_limit_bytes: number | null;
    allowed_mime_types: readonly string[] | null;
  };
  application_contract: {
    admin_upload_service: "v2-admin-upload-resource-file";
    admin_upload_auth: "verify_jwt_admin";
    customer_download_service: "resource-download";
    customer_download_auth: "custom_bearer_and_entitlement_rpc";
    package_scan_control_service: "v2-admin-package-scan-control";
    package_scan_worker_service: "v2-package-scan-worker";
    max_upload_bytes: 26214400;
    signed_url_ttl_seconds: 60;
    approved_mime_types: readonly string[];
  };
  registry: {
    registered_files: number;
    registered_bytes: number;
    checksum_ready_files: number;
    last_registered_at: string | null;
  };
  scan_counts: StorageScanCounts;
  downloads: {
    authorized_24h: number;
    last_authorized_at: string | null;
  };
  boundaries: {
    bucket_object_existence: "not_checked";
    signed_url_generation: "not_checked";
    storage_quota_capacity: "not_checked";
    service_runtime_health: "not_checked";
  };
};

// Keys we accept from the server. Anything else (including possible future
// secret-like fields) is dropped.
const ALLOWED_TOP = new Set([
  "provider", "as_of", "bucket", "application_contract",
  "registry", "scan_counts", "downloads", "boundaries",
]);
const FORBIDDEN_TOP = new Set([
  "service_role_key", "anon_key", "token", "secret", "env", "raw_env",
  "objects", "paths", "storage_path", "checksums", "findings",
]);

function isBool(v: unknown): v is boolean { return typeof v === "boolean"; }
function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= 0;
}
function isIsoString(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}
function isIsoOrNull(v: unknown): v is string | null {
  return v === null || isIsoString(v);
}

function normalizeMimeArray(v: unknown): string[] | null | false {
  if (v === null) return null;
  if (!Array.isArray(v)) return false;
  // Reject any non-string / empty / whitespace-padded entries; do not silently drop.
  const out: string[] = [];
  for (const e of v) {
    if (typeof e !== "string") return false;
    if (e.length === 0 || e !== e.trim()) return false;
    if (e.length > 128) return false;
    out.push(e);
  }
  return out;
}

export function normalizeStorageSettingsStatus(
  input: unknown,
): StorageSettingsStatus | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  // Reject if forbidden keys are present at the top level.
  for (const k of Object.keys(raw)) {
    if (FORBIDDEN_TOP.has(k)) return null;
  }

  // Strip: only keep allowed top-level keys.
  const top: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (ALLOWED_TOP.has(k)) top[k] = v;
  }

  if (top.provider !== "supabase_storage") return null;
  if (!isIsoString(top.as_of)) return null;

  const bucket = top.bucket as Record<string, unknown> | undefined;
  if (!bucket || typeof bucket !== "object") return null;
  if (bucket.id !== STORAGE_BUCKET_ID) return null;
  if (!isBool(bucket.present)) return null;
  const bPublic = bucket.public;
  if (bPublic !== null && !isBool(bPublic)) return null;
  const bLimit = bucket.file_size_limit_bytes;
  if (bLimit !== null && !isNonNegInt(bLimit)) return null;
  const bMime = normalizeMimeArray(bucket.allowed_mime_types);
  if (bMime === false) return null;

  const ac = top.application_contract as Record<string, unknown> | undefined;
  if (!ac || typeof ac !== "object") return null;
  if (ac.admin_upload_service !== STORAGE_ADMIN_UPLOAD_SERVICE) return null;
  if (ac.admin_upload_auth !== STORAGE_ADMIN_UPLOAD_AUTH) return null;
  if (ac.customer_download_service !== STORAGE_CUSTOMER_DOWNLOAD_SERVICE) return null;
  if (ac.customer_download_auth !== STORAGE_CUSTOMER_DOWNLOAD_AUTH) return null;
  if (ac.package_scan_control_service !== STORAGE_SCAN_CONTROL_SERVICE) return null;
  if (ac.package_scan_worker_service !== STORAGE_SCAN_WORKER_SERVICE) return null;
  if (ac.max_upload_bytes !== STORAGE_MAX_UPLOAD_BYTES) return null;
  if (ac.signed_url_ttl_seconds !== STORAGE_SIGNED_URL_TTL_SECONDS) return null;
  const acMime = normalizeMimeArray(ac.approved_mime_types);
  if (acMime === false || acMime === null || acMime.length === 0) return null;

  const registry = top.registry as Record<string, unknown> | undefined;
  if (!registry || typeof registry !== "object") return null;
  const registered_files = registry.registered_files;
  const registered_bytes = registry.registered_bytes;
  const checksum_ready_files = registry.checksum_ready_files;
  if (!isNonNegInt(registered_files)) return null;
  if (!isNonNegInt(registered_bytes)) return null;
  if (!isNonNegInt(checksum_ready_files)) return null;
  if (checksum_ready_files > registered_files) return null;
  if (!isIsoOrNull(registry.last_registered_at)) return null;

  const sc = top.scan_counts as Record<string, unknown> | undefined;
  if (!sc || typeof sc !== "object") return null;
  const buckets: (keyof StorageScanCounts)[] = [
    "clean", "pending", "suspicious", "malicious", "failed", "unscanned",
  ];
  const counts: Partial<StorageScanCounts> = {};
  for (const key of buckets) {
    const val = (sc as Record<string, unknown>)[key];
    if (!isNonNegInt(val)) return null;
    counts[key] = val;
  }
  const scanSum =
    counts.clean! + counts.pending! + counts.suspicious! +
    counts.malicious! + counts.failed! + counts.unscanned!;
  if (scanSum !== registered_files) return null;

  const downloads = top.downloads as Record<string, unknown> | undefined;
  if (!downloads || typeof downloads !== "object") return null;
  if (!isNonNegInt(downloads.authorized_24h)) return null;
  if (!isIsoOrNull(downloads.last_authorized_at)) return null;

  const boundaries = top.boundaries as Record<string, unknown> | undefined;
  if (!boundaries || typeof boundaries !== "object") return null;
  if (boundaries.bucket_object_existence !== "not_checked") return null;
  if (boundaries.signed_url_generation !== "not_checked") return null;
  if (boundaries.storage_quota_capacity !== "not_checked") return null;
  if (boundaries.service_runtime_health !== "not_checked") return null;

  return {
    provider: "supabase_storage",
    as_of: top.as_of,
    bucket: {
      id: STORAGE_BUCKET_ID,
      present: bucket.present,
      public: bPublic as boolean | null,
      file_size_limit_bytes: bLimit as number | null,
      allowed_mime_types: bMime,
    },
    application_contract: {
      admin_upload_service: STORAGE_ADMIN_UPLOAD_SERVICE,
      admin_upload_auth: STORAGE_ADMIN_UPLOAD_AUTH,
      customer_download_service: STORAGE_CUSTOMER_DOWNLOAD_SERVICE,
      customer_download_auth: STORAGE_CUSTOMER_DOWNLOAD_AUTH,
      package_scan_control_service: STORAGE_SCAN_CONTROL_SERVICE,
      package_scan_worker_service: STORAGE_SCAN_WORKER_SERVICE,
      max_upload_bytes: STORAGE_MAX_UPLOAD_BYTES,
      signed_url_ttl_seconds: STORAGE_SIGNED_URL_TTL_SECONDS,
      approved_mime_types: acMime,
    },
    registry: {
      registered_files,
      registered_bytes,
      checksum_ready_files,
      last_registered_at: registry.last_registered_at as string | null,
    },
    scan_counts: counts as StorageScanCounts,
    downloads: {
      authorized_24h: downloads.authorized_24h,
      last_authorized_at: downloads.last_authorized_at as string | null,
    },
    boundaries: {
      bucket_object_existence: "not_checked",
      signed_url_generation: "not_checked",
      storage_quota_capacity: "not_checked",
      service_runtime_health: "not_checked",
    },
  };
}

// -------------------- Presentation helpers --------------------------------

export type StatusTone = "ok" | "warn" | "info" | "danger";

export function bucketReadiness(
  status: StorageSettingsStatus,
): { ready: boolean; reason: string } {
  const b = status.bucket;
  if (!b.present) return { ready: false, reason: "Bucket missing" };
  if (b.public === true) return { ready: false, reason: "Bucket is public — must be private" };
  return { ready: true, reason: "Present and private" };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KiB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MiB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GiB`;
}

export const STORAGE_NAV_LINKS: readonly {
  to: string; label: string; description: string;
}[] = [
  {
    to: "/admin/publishing/versions",
    label: "Versions registry",
    description: "Browse resource versions and their package files",
  },
  {
    to: "/admin/trust/scans",
    label: "Package scans",
    description: "Review scanner queue, history, and results",
  },
];

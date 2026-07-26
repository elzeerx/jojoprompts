// v2-admin-storage-settings-status
// Admin-only, read-only safe configuration status for the Supabase Storage
// bucket that backs resource package files. Never returns bucket object
// names, storage paths, checksums, findings, or secret material, and never
// performs listing/downloading/signed-URL/scanner calls.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeadersFor, jsonResponse, methodGuard, requireAdmin,
} from "../_shared/v2Upayments.ts";

const BUCKET_ID = "resource-packages";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60;
const ALLOWED_MIME_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "text/markdown",
  "text/plain",
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "text/x-yaml",
] as const;

type ScanCounts = {
  clean: number; pending: number; suspicious: number;
  malicious: number; failed: number; unscanned: number;
};

function toNonNegInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0 && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) {
    const n = Number(v);
    if (Number.isSafeInteger(n) && n >= 0) return n;
  }
  return 0;
}
function toIsoOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
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
  let bucketPresent = false;
  let bucketPublic: boolean | null = null;
  let bucketFileSizeLimit: number | null = null;
  let bucketAllowedMimeTypes: readonly string[] | null = null;
  try {
    const { data, error } = await svc.storage.listBuckets();
    if (error) {
      return jsonResponse({ error: "storage_status_unavailable" }, 502, origin);
    }
    const b = (data ?? []).find((x) => x?.id === BUCKET_ID) as
      | { id: string; public?: boolean; file_size_limit?: number | null; allowed_mime_types?: string[] | null }
      | undefined;
    if (b) {
      bucketPresent = true;
      bucketPublic = typeof b.public === "boolean" ? b.public : null;
      bucketFileSizeLimit = typeof b.file_size_limit === "number" ? b.file_size_limit : null;
      bucketAllowedMimeTypes = Array.isArray(b.allowed_mime_types)
        ? b.allowed_mime_types.filter((s): s is string => typeof s === "string")
        : null;
    }
  } catch {
    return jsonResponse({ error: "storage_status_unavailable" }, 502, origin);
  }

  // ---- Aggregate registry / scan / downloads via internal RPC -------------
  let asOf = new Date().toISOString();
  let registeredFiles = 0;
  let registeredBytes = 0;
  let checksumReadyFiles = 0;
  let lastRegisteredAt: string | null = null;
  let scanCounts: ScanCounts = {
    clean: 0, pending: 0, suspicious: 0, malicious: 0, failed: 0, unscanned: 0,
  };
  let authorized24h = 0;
  let lastAuthorizedAt: string | null = null;
  try {
    const { data, error } = await svc.rpc(
      "v2_internal_admin_storage_settings_summary" as never,
    );
    if (error || !data || typeof data !== "object") {
      return jsonResponse({ error: "storage_status_unavailable" }, 502, origin);
    }
    const d = data as Record<string, unknown>;
    asOf = toIsoOrNull(d.as_of) ?? asOf;
    registeredFiles = toNonNegInt(d.registered_files);
    registeredBytes = toNonNegInt(d.registered_bytes);
    checksumReadyFiles = toNonNegInt(d.checksum_ready_files);
    lastRegisteredAt = toIsoOrNull(d.last_registered_at);
    const sc = (d.scan_counts ?? {}) as Record<string, unknown>;
    scanCounts = {
      clean: toNonNegInt(sc.clean),
      pending: toNonNegInt(sc.pending),
      suspicious: toNonNegInt(sc.suspicious),
      malicious: toNonNegInt(sc.malicious),
      failed: toNonNegInt(sc.failed),
      unscanned: toNonNegInt(sc.unscanned),
    };
    const dl = (d.downloads ?? {}) as Record<string, unknown>;
    authorized24h = toNonNegInt(dl.authorized_24h);
    lastAuthorizedAt = toIsoOrNull(dl.last_authorized_at);
  } catch {
    return jsonResponse({ error: "storage_status_unavailable" }, 502, origin);
  }

  const body = {
    provider: "supabase_storage" as const,
    as_of: asOf,
    bucket: {
      id: BUCKET_ID,
      present: bucketPresent,
      public: bucketPublic,
      file_size_limit_bytes: bucketFileSizeLimit,
      allowed_mime_types: bucketAllowedMimeTypes,
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
      approved_mime_types: ALLOWED_MIME_TYPES,
    },
    registry: {
      registered_files: registeredFiles,
      registered_bytes: registeredBytes,
      checksum_ready_files: checksumReadyFiles,
      last_registered_at: lastRegisteredAt,
    },
    scan_counts: scanCounts,
    downloads: {
      authorized_24h: authorized24h,
      last_authorized_at: lastAuthorizedAt,
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

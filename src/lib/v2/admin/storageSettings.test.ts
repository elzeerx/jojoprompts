import { describe, expect, test } from "bun:test";
import {
  bucketReadiness,
  formatBytes,
  normalizeStorageSettingsStatus,
  STORAGE_MAX_UPLOAD_BYTES,
} from "./storageSettings";

function live(): unknown {
  return {
    provider: "supabase_storage",
    as_of: "2026-07-26T08:00:00.000Z",
    bucket: {
      id: "resource-packages",
      present: true,
      public: false,
      file_size_limit_bytes: STORAGE_MAX_UPLOAD_BYTES,
      allowed_mime_types: ["application/zip", "text/markdown"],
    },
    application_contract: {
      admin_upload_service: "v2-admin-upload-resource-file",
      admin_upload_auth: "verify_jwt_admin",
      customer_download_service: "resource-download",
      customer_download_auth: "custom_bearer_and_entitlement_rpc",
      package_scan_control_service: "v2-admin-package-scan-control",
      package_scan_worker_service: "v2-package-scan-worker",
      max_upload_bytes: STORAGE_MAX_UPLOAD_BYTES,
      signed_url_ttl_seconds: 60,
      approved_mime_types: ["application/zip", "text/markdown", "application/json"],
    },
    registry: {
      registered_files: 3,
      registered_bytes: 12345,
      checksum_ready_files: 3,
      last_registered_at: "2026-07-25T12:00:00.000Z",
    },
    scan_counts: {
      clean: 2, pending: 0, suspicious: 0, malicious: 0, failed: 0, unscanned: 1,
    },
    downloads: {
      authorized_24h: 4,
      last_authorized_at: "2026-07-25T14:00:00.000Z",
    },
    boundaries: {
      bucket_object_existence: "not_checked",
      signed_url_generation: "not_checked",
      storage_quota_capacity: "not_checked",
      service_runtime_health: "not_checked",
    },
  };
}

describe("normalizeStorageSettingsStatus - accept", () => {
  test("accepts live-shaped payload", () => {
    const n = normalizeStorageSettingsStatus(live());
    expect(n).not.toBeNull();
    expect(n!.bucket.id).toBe("resource-packages");
    expect(n!.scan_counts.clean).toBe(2);
    expect(n!.application_contract.max_upload_bytes).toBe(STORAGE_MAX_UPLOAD_BYTES);
  });
  test("public=null bucket allowed (info missing) but not ready", () => {
    const p = live() as any;
    p.bucket.public = null;
    const n = normalizeStorageSettingsStatus(p);
    expect(n).not.toBeNull();
    expect(bucketReadiness(n!).ready).toBe(true);
  });
});

describe("normalizeStorageSettingsStatus - reject", () => {
  test("rejects wrong provider literal", () => {
    const p = live() as any; p.provider = "s3";
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects wrong bucket id", () => {
    const p = live() as any; p.bucket.id = "public-assets";
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects wrong service slug", () => {
    const p = live() as any;
    p.application_contract.customer_download_service = "unknown-download";
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects wrong max upload bytes", () => {
    const p = live() as any; p.application_contract.max_upload_bytes = 1;
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects wrong ttl", () => {
    const p = live() as any; p.application_contract.signed_url_ttl_seconds = 120;
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects impossible scan sum vs registered_files", () => {
    const p = live() as any;
    p.scan_counts = { clean: 0, pending: 0, suspicious: 0, malicious: 0, failed: 0, unscanned: 0 };
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects negative count", () => {
    const p = live() as any; p.scan_counts.clean = -1;
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects non-integer count", () => {
    const p = live() as any; p.scan_counts.clean = 1.5;
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects checksum_ready_files exceeding registered_files", () => {
    const p = live() as any; p.registry.checksum_ready_files = 99;
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects malformed timestamp", () => {
    const p = live() as any; p.as_of = "not-a-date";
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects wrong boundary literal", () => {
    const p = live() as any; p.boundaries.signed_url_generation = "checked";
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects malformed allowed_mime_types entry (non-string)", () => {
    const p = live() as any; p.bucket.allowed_mime_types = ["application/zip", 123];
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects malformed allowed_mime_types entry (whitespace)", () => {
    const p = live() as any; p.bucket.allowed_mime_types = [" application/zip"];
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects secret-like top-level key", () => {
    const p = live() as any; p.service_role_key = "leak";
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects storage_path leak field", () => {
    const p = live() as any; p.storage_path = "/leak";
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
  test("rejects missing downloads block", () => {
    const p = live() as any; delete p.downloads;
    expect(normalizeStorageSettingsStatus(p)).toBeNull();
  });
});

describe("bucketReadiness", () => {
  test("public bucket is not ready", () => {
    const p = live() as any; p.bucket.public = true;
    const n = normalizeStorageSettingsStatus(p);
    expect(n).not.toBeNull();
    const r = bucketReadiness(n!);
    expect(r.ready).toBe(false);
  });
  test("missing bucket is not ready", () => {
    const p = live() as any; p.bucket.present = false;
    const n = normalizeStorageSettingsStatus(p);
    expect(n).not.toBeNull();
    expect(bucketReadiness(n!).ready).toBe(false);
  });
});

describe("formatBytes", () => {
  test("formats MiB", () => {
    expect(formatBytes(STORAGE_MAX_UPLOAD_BYTES)).toBe("25.00 MiB");
  });
  test("handles zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
});

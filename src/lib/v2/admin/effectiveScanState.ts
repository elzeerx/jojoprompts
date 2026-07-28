// Pure-JS model of public.v2_internal_effective_scan_state used to drive
// adversarial fail-closed tests. Mirrors the SQL semantics 1:1:
//   * no current files                        => effective 'unscanned', coverage false
//   * no scans                                => 'unscanned', coverage false
//   * latest stored 'clean' AND items are an EXACT set match on DISTINCT
//     resource_file_ids with the version's current resource_files AND every
//     such item status='clean'                => 'clean', coverage true
//   * any drift (append, remove, replace, wrong file, duplicate item trick,
//     missing item, extra item, non-clean item) with stored clean
//                                             => 'unscanned', coverage false
//   * stored pending/suspicious/malicious/failed => passthrough, coverage false
//
// Kept dependency-free for reuse from Node/Vitest and Deno tests.

export type ScanStatus =
  | "pending"
  | "clean"
  | "suspicious"
  | "malicious"
  | "failed";

export interface ScanItem {
  id: string;
  package_scan_id: string;
  resource_file_id: string | null;
  status: ScanStatus;
}
export interface Scan {
  id: string;
  resource_version_id: string;
  status: ScanStatus;
  created_at: string; // ISO
  scanned_at?: string | null;
  completed_at?: string | null;
}
export interface ResourceFile {
  id: string;
  resource_version_id: string;
}

export interface EffectiveScanState {
  has_files: boolean;
  latest_scan_id: string | null;
  stored_status: ScanStatus | "unscanned";
  effective_status: ScanStatus | "unscanned";
  coverage_valid: boolean;
  current_file_count: number;
  scanned_file_count: number;
}

export function effectiveScanState(input: {
  versionId: string;
  files: readonly ResourceFile[];
  scans: readonly Scan[];
  items: readonly ScanItem[];
}): EffectiveScanState {
  const currentFiles = input.files.filter(
    (f) => f.resource_version_id === input.versionId,
  );
  const currentFileIds = new Set(currentFiles.map((f) => f.id));
  const currentFileCount = currentFileIds.size;

  const versionScans = input.scans
    .filter((s) => s.resource_version_id === input.versionId)
    .slice()
    .sort((a, b) => {
      if (a.created_at !== b.created_at) {
        return a.created_at < b.created_at ? 1 : -1;
      }
      const av = a.scanned_at ?? "";
      const bv = b.scanned_at ?? "";
      if (av !== bv) return av < bv ? 1 : -1;
      return a.id < b.id ? 1 : -1;
    });
  const latest = versionScans[0] ?? null;

  if (currentFileCount === 0) {
    return {
      has_files: false,
      latest_scan_id: latest?.id ?? null,
      stored_status: (latest?.status ?? "unscanned"),
      effective_status: "unscanned",
      coverage_valid: false,
      current_file_count: 0,
      scanned_file_count: 0,
    };
  }
  if (!latest) {
    return {
      has_files: true,
      latest_scan_id: null,
      stored_status: "unscanned",
      effective_status: "unscanned",
      coverage_valid: false,
      current_file_count: currentFileCount,
      scanned_file_count: 0,
    };
  }

  const latestItems = input.items.filter(
    (i) => i.package_scan_id === latest.id && i.resource_file_id != null,
  );

  if (latest.status !== "clean") {
    const distinctScanned = new Set(
      latestItems.map((i) => i.resource_file_id as string),
    );
    return {
      has_files: true,
      latest_scan_id: latest.id,
      stored_status: latest.status,
      effective_status: latest.status,
      coverage_valid: false,
      current_file_count: currentFileCount,
      scanned_file_count: distinctScanned.size,
    };
  }

  // DISTINCT ON (resource_file_id) — first item by id per file
  const byFile = new Map<string, ScanItem>();
  for (const it of latestItems.slice().sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!byFile.has(it.resource_file_id as string)) {
      byFile.set(it.resource_file_id as string, it);
    }
  }
  const distinctItems = Array.from(byFile.values());
  const distinctScannedIds = new Set(byFile.keys());
  const scannedFilesInCurrent = distinctItems.filter(
    (i) => currentFileIds.has(i.resource_file_id as string),
  );
  const allClean = distinctItems.length > 0 &&
    distinctItems.every((i) => i.status === "clean");
  const coverageValid = allClean &&
    scannedFilesInCurrent.length === currentFileCount &&
    distinctScannedIds.size === currentFileCount;

  return {
    has_files: true,
    latest_scan_id: latest.id,
    stored_status: "clean",
    effective_status: coverageValid ? "clean" : "unscanned",
    coverage_valid: coverageValid,
    current_file_count: currentFileCount,
    scanned_file_count: scannedFilesInCurrent.length,
  };
}

// Mirrors public.authorize_resource_download fail-closed policy.
export function authorizeDownload(input: {
  fileId: string;
  versionId: string;
  files: readonly ResourceFile[];
  scans: readonly Scan[];
  items: readonly ScanItem[];
  entitled: boolean;
}): { allowed: boolean; reason?: "not_authorized" | "package_unavailable" } {
  if (!input.entitled) return { allowed: false, reason: "not_authorized" };
  const eff = effectiveScanState(input);
  if (eff.effective_status !== "clean" || !eff.coverage_valid) {
    return { allowed: false, reason: "package_unavailable" };
  }
  const clean = input.items.some(
    (i) =>
      i.package_scan_id === eff.latest_scan_id &&
      i.resource_file_id === input.fileId &&
      i.status === "clean",
  );
  if (!clean) return { allowed: false, reason: "package_unavailable" };
  return { allowed: true };
}

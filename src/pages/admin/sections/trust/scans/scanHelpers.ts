import type {
  PackageScanState,
  PackageScanSummary,
} from "@/hooks/admin/v2/useAdminPackageScans";

const ATTENTION_STATES: PackageScanState[] = [
  "malicious",
  "suspicious",
  "failed",
];

export function attentionCount(summary: PackageScanSummary | null | undefined): number {
  if (!summary) return 0;
  return ATTENTION_STATES.reduce((sum, s) => sum + (summary[s] ?? 0), 0);
}

export function isAttentionState(state: PackageScanState): boolean {
  return ATTENTION_STATES.includes(state);
}

export function statusLabel(state: PackageScanState): string {
  switch (state) {
    case "unscanned":
      return "Unscanned";
    case "pending":
      return "Pending";
    case "clean":
      return "Clean";
    case "suspicious":
      return "Suspicious";
    case "malicious":
      return "Malicious";
    case "failed":
      return "Failed";
    default:
      return state;
  }
}

export function statusTone(
  state: PackageScanState,
): "default" | "secondary" | "destructive" | "outline" {
  if (state === "clean") return "secondary";
  if (state === "pending") return "default";
  if (state === "suspicious" || state === "malicious" || state === "failed") {
    return "destructive";
  }
  return "outline";
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatFindings(findings: unknown): string {
  if (findings === null || findings === undefined) return "{}";
  try {
    return JSON.stringify(findings, null, 2);
  } catch {
    return "{}";
  }
}

export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  const max = Math.max(1, Math.floor(totalPages));
  return Math.min(Math.floor(page), max);
}

export function totalPagesFor(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0) return 1;
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

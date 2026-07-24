import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ResourceType =
  | "skill"
  | "automation"
  | "prompt"
  | "prompt_pack"
  | "image_style"
  | "bundle";

export type ScanState =
  | "pending"
  | "clean"
  | "suspicious"
  | "malicious"
  | "failed"
  | "unscanned";

export type CurrentFilter = "all" | "current" | "historical";

export interface AdminResourceVersionRow {
  version_id: string;
  resource_id: string;
  slug: string;
  resource_type: ResourceType;
  lifecycle: string;
  title_en: string;
  title_ar: string | null;
  version: string;
  major_version: number;
  is_current: boolean;
  published_at: string | null;
  updated_at: string;
  package_size_bytes: number | null;
  package_checksum_present: boolean;
  file_count: number;
  scan_count: number;
  latest_scan_status: ScanState | null;
  latest_scanner: string | null;
  latest_scanned_at: string | null;
}

export interface AdminResourceVersionsSummary {
  total_versions: number;
  current_versions: number;
  versions_with_files: number;
  unscanned_versions: number;
  scan_attention: number;
}

export interface AdminResourceVersionsList {
  total_count: number;
  limit: number;
  offset: number;
  rows: AdminResourceVersionRow[];
  summary: AdminResourceVersionsSummary;
}

export interface AdminResourceVersionsListParams {
  types?: ResourceType[] | null;
  scanStates?: ScanState[] | null;
  current?: CurrentFilter;
  search?: string | null;
  limit?: number;
  offset?: number;
}

export const adminResourceVersionsKeys = {
  list: (p: AdminResourceVersionsListParams) =>
    ["admin", "v2", "resource-versions", "list", p] as const,
  detail: (id: string | null) =>
    ["admin", "v2", "resource-versions", "detail", id] as const,
};

export function useAdminResourceVersions(params: AdminResourceVersionsListParams) {
  return useQuery<AdminResourceVersionsList>({
    queryKey: adminResourceVersionsKeys.list(params),
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "v2_admin_list_resource_versions",
        {
          p_types: params.types ?? null,
          p_scan_states: params.scanStates ?? null,
          p_current: params.current ?? "all",
          p_search: params.search ?? null,
          p_limit: params.limit ?? 50,
          p_offset: params.offset ?? 0,
        },
      );
      if (error) throw error;
      return (
        (data as unknown as AdminResourceVersionsList) ?? {
          total_count: 0,
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
          rows: [],
          summary: {
            total_versions: 0,
            current_versions: 0,
            versions_with_files: 0,
            unscanned_versions: 0,
            scan_attention: 0,
          },
        }
      );
    },
    staleTime: 15_000,
  });
}

export interface AdminResourceVersionFile {
  id: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  checksum_sha256: string | null;
  created_at: string;
}

export interface AdminResourceVersionScan {
  id: string;
  scanner: string;
  status: ScanState;
  findings: unknown;
  scanned_at: string | null;
  created_at: string;
}

export interface AdminResourceVersionDetail {
  version: {
    version_id: string;
    resource_id: string;
    slug: string;
    resource_type: ResourceType;
    lifecycle: string;
    title_en: string;
    title_ar: string | null;
    version: string;
    major_version: number;
    is_current: boolean;
    published_at: string | null;
    created_at: string;
    updated_at: string;
    changelog_en: string | null;
    changelog_ar: string | null;
    package_size_bytes: number | null;
    package_checksum: string | null;
  };
  files: AdminResourceVersionFile[];
  scans: AdminResourceVersionScan[];
}

export function useAdminResourceVersionDetail(versionId: string | null) {
  return useQuery<AdminResourceVersionDetail | null>({
    queryKey: adminResourceVersionsKeys.detail(versionId),
    queryFn: async () => {
      if (!versionId) return null;
      const { data, error } = await supabase.rpc(
        "v2_admin_get_resource_version_detail",
        { p_version_id: versionId },
      );
      if (error) throw error;
      return (data as unknown as AdminResourceVersionDetail) ?? null;
    },
    enabled: !!versionId,
    staleTime: 15_000,
  });
}

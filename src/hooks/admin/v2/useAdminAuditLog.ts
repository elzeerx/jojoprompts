import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditEventRow {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_type: "user" | "admin" | "system" | string;
  actor_email_masked: string | null;
  actor_username: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  ip_address: string | null;
  metadata_preview: string | null;
}

export interface AuditEventDetail extends Omit<AuditEventRow, "metadata_preview"> {
  metadata: Record<string, unknown> | null;
}

export interface AuditListResult {
  total_count: number;
  limit: number;
  offset: number;
  rows: AuditEventRow[];
}

export interface AuditListParams {
  actorTypes?: string[] | null;
  entityTypes?: string[] | null;
  actions?: string[] | null;
  actorUserId?: string | null;
  entityId?: string | null;
  search?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
  offset?: number;
}

export const adminAuditKeys = {
  list: (p: AuditListParams) => ["admin", "v2", "audit", "list", p] as const,
  detail: (id: string | null) => ["admin", "v2", "audit", "detail", id] as const,
};

/** Serialize hook params into RPC parameters. Exported for tests. */
export function serializeAuditParams(p: AuditListParams) {
  const emptyToNull = (arr?: string[] | null) =>
    arr && arr.length > 0 ? arr : null;
  return {
    p_actor_types: emptyToNull(p.actorTypes),
    p_entity_types: emptyToNull(p.entityTypes),
    p_actions: emptyToNull(p.actions),
    p_actor_user_id: p.actorUserId ?? null,
    p_entity_id: p.entityId ?? null,
    p_search: p.search && p.search.trim() ? p.search.trim() : null,
    p_from: p.from ?? null,
    p_to: p.to ?? null,
    p_limit: p.limit ?? 50,
    p_offset: p.offset ?? 0,
  };
}

export function useAdminAuditLog(params: AuditListParams) {
  return useQuery<AuditListResult>({
    queryKey: adminAuditKeys.list(params),
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "v2_admin_list_activity_events",
        serializeAuditParams(params) as never
      );
      if (error) throw error;
      return (
        (data as unknown as AuditListResult) ?? {
          total_count: 0,
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
          rows: [],
        }
      );
    },
    staleTime: 15_000,
  });
}

export function useAdminAuditEvent(id: string | null) {
  return useQuery<AuditEventDetail | null>({
    queryKey: adminAuditKeys.detail(id),
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.rpc(
        "v2_admin_get_activity_event",
        { p_id: id } as never
      );
      if (error) throw error;
      return (data as unknown as AuditEventDetail) ?? null;
    },
    staleTime: 60_000,
  });
}

/**
 * Curated action allowlist, derived from V2 activity_events writers across
 * the codebase. Frontend-only — used to populate the action filter without
 * a schema-scan query. Additions here are purely cosmetic.
 */
export const AUDIT_ACTION_ALLOWLIST = [
  "report.submitted",
  "report.status_changed",
  "order.created",
  "order.status_changed",
  "order.paid",
  "order.failed",
  "order.refunded",
  "refund.requested",
  "refund.approved",
  "refund.denied",
  "refund.processed",
  "discount.created",
  "discount.redeemed",
  "discount.archived",
  "resource.published",
  "resource.lifecycle_changed",
  "resource_version.created",
  "resource_version.finalized",
  "package_scan.queued",
  "package_scan.completed",
  "download.granted",
  "download.denied",
  "entitlement.granted",
  "entitlement.revoked",
] as const;

export const AUDIT_ACTOR_TYPES = ["user", "admin", "system"] as const;

export const AUDIT_ENTITY_TYPES = [
  "report",
  "order",
  "refund",
  "discount",
  "discount_code",
  "resource",
  "resource_version",
  "package_scan",
  "entitlement",
  "user",
  "profile",
] as const;

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractInvokeErrorCode } from "@/lib/v2/invokeErrors";

/**
 * Shared query keys for Phase 5 admin commerce read RPCs.
 * All hooks below wrap SECURITY DEFINER RPCs that require an admin caller.
 * We never touch the raw locked commerce tables from the client.
 */
export const adminCommerceKeys = {
  metrics: (periodDays: number) => ["admin", "v2", "metrics", periodDays] as const,
  ordersList: (params: OrdersListParams) => ["admin", "v2", "orders", "list", params] as const,
  orderDetail: (orderId: string | null) => ["admin", "v2", "orders", "detail", orderId] as const,
  paymentEventsList: (params: PaymentEventsListParams) =>
    ["admin", "v2", "payment-events", "list", params] as const,
  paymentEventDetail: (eventId: string | null) =>
    ["admin", "v2", "payment-events", "detail", eventId] as const,
  entitlementsList: (params: EntitlementsListParams) =>
    ["admin", "v2", "entitlements", "list", params] as const,
  refundsList: (params: RefundsListParams) => ["admin", "v2", "refunds", "list", params] as const,
  refundDetail: (id: string | null) => ["admin", "v2", "refunds", "detail", id] as const,
  refundableOrder: (id: string | null) => ["admin", "v2", "refunds", "refundable", id] as const,
  recoveryList: (params: RecoveryListParams) => ["admin", "v2", "recovery", "list", params] as const,
  recoveryCounts: () => ["admin", "v2", "recovery", "counts"] as const,
};

// ---------- Types (shapes returned by the JSON RPCs) ----------
export interface AdminMetrics {
  period_days: number;
  from: string;
  to: string;
  currency: string;
  revenue_fils: number;
  orders_paid: number;
  orders_pending: number;
  orders_failed: number;
  orders_refunded: number;
  refunds_processed_fils: number;
  refunds_pending: number;
  lifetime_direct_unlocks: number;
  lifetime_threshold_unlocks: number;
}

export interface OrdersListParams {
  status?: string | null;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
  offset?: number;
}

export interface AdminOrderRow {
  id: string;
  order_number: string;
  status: string;
  currency: string;
  subtotal_fils: number;
  discount_fils: number;
  total_fils: number;
  paid_fils: number;
  lifetime_credit_applied_fils: number;
  provider: string | null;
  provider_reference: string | null;
  user_id: string | null;
  user_email_masked: string | null;
  placed_at: string | null;
  settled_at: string | null;
  created_at: string;
  attention: string | null;
}

export interface PagedResult<T> {
  total_count: number;
  rows: T[];
  limit: number;
  offset: number;
}

export interface PaymentEventsListParams {
  eventType?: string | null;
  provider?: string | null;
  orderId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
  offset?: number;
}

export interface AdminPaymentEventRow {
  id: string;
  order_id: string | null;
  order_number: string | null;
  provider: string;
  event_type: string;
  external_event_id: string | null;
  amount_fils: number | null;
  currency: string | null;
  received_at: string;
}

export interface EntitlementsListParams {
  scope?: string | null;
  state?: string | null;
  reason?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}

export interface AdminEntitlementRow {
  id: string;
  user_id: string;
  user_email_masked: string | null;
  scope: "resource" | "library" | "collection" | string;
  collection_key: "chatgpt_prompts" | "midjourney_prompts" | string | null;
  resource_id: string | null;
  resource_title: string | null;
  resource_type: string | null;
  grant_reason: string;
  order_id: string | null;
  source_order_item_id: string | null;
  granted_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  expires_at: string | null;
  version_major: number | null;
  state: "active" | "revoked" | "expired";
}

/** Bilingual, human-readable label for an entitlement scope + collection_key. */
export function describeEntitlementTarget(row: Pick<AdminEntitlementRow,
  "scope" | "collection_key" | "resource_title">): string {
  if (row.scope === "library") return "Full library / كامل المكتبة";
  if (row.scope === "collection") {
    if (row.collection_key === "chatgpt_prompts") return "ChatGPT prompts collection / مجموعة ChatGPT";
    if (row.collection_key === "midjourney_prompts") return "Midjourney prompts collection / مجموعة Midjourney";
    return row.collection_key ?? "Collection";
  }
  return row.resource_title ?? "—";
}

export interface RefundsListParams {
  status?: string | null;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
  offset?: number;
}

export interface RecoveryListParams {
  kind?: string | null;
  minAgeMinutes?: number;
  limit?: number;
  offset?: number;
}

// ---------- Hooks ----------

function unwrap<T>(data: unknown): T {
  return data as T;
}

export function useAdminMetrics(periodDays: number, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: adminCommerceKeys.metrics(periodDays),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("v2_admin_order_metrics", {
        p_period_days: periodDays,
      });
      if (error) throw error;
      return unwrap<AdminMetrics>(data);
    },
    staleTime: 30_000,
    ...(opts as object),
  });
}

export function useAdminOrders(params: OrdersListParams) {
  return useQuery({
    queryKey: adminCommerceKeys.ordersList(params),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("v2_admin_list_orders", {
        p_status: params.status ?? undefined,
        p_search: params.search ?? undefined,
        p_date_from: params.dateFrom ?? undefined,
        p_date_to: params.dateTo ?? undefined,
        p_limit: params.limit ?? 50,
        p_offset: params.offset ?? 0,
      });
      if (error) throw error;
      return unwrap<PagedResult<AdminOrderRow>>(data);
    },
    staleTime: 15_000,
  });
}

export function useAdminOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: adminCommerceKeys.orderDetail(orderId),
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("v2_admin_get_order_detail", {
        p_order_id: orderId!,
      });
      if (error) throw error;
      return data as Record<string, unknown>;
    },
  });
}

export function useAdminPaymentEvents(params: PaymentEventsListParams) {
  return useQuery({
    queryKey: adminCommerceKeys.paymentEventsList(params),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("v2_admin_list_payment_events", {
        p_event_type: params.eventType ?? undefined,
        p_provider: params.provider ?? undefined,
        p_order_id: params.orderId ?? undefined,
        p_date_from: params.dateFrom ?? undefined,
        p_date_to: params.dateTo ?? undefined,
        p_limit: params.limit ?? 50,
        p_offset: params.offset ?? 0,
      });
      if (error) throw error;
      return unwrap<PagedResult<AdminPaymentEventRow>>(data);
    },
    staleTime: 15_000,
  });
}

export function useAdminPaymentEventDetail(eventId: string | null) {
  return useQuery({
    queryKey: adminCommerceKeys.paymentEventDetail(eventId),
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("v2_admin_get_payment_event", {
        p_event_id: eventId!,
      });
      if (error) throw error;
      return data as Record<string, unknown>;
    },
  });
}

export function useAdminEntitlements(params: EntitlementsListParams) {
  return useQuery({
    queryKey: adminCommerceKeys.entitlementsList(params),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("v2_admin_list_entitlements", {
        p_scope: params.scope ?? undefined,
        p_state: params.state ?? undefined,
        p_reason: params.reason ?? undefined,
        p_search: params.search ?? undefined,
        p_limit: params.limit ?? 50,
        p_offset: params.offset ?? 0,
      });
      if (error) throw error;
      return unwrap<PagedResult<AdminEntitlementRow>>(data);
    },
    staleTime: 15_000,
  });
}

// ---------- Phase 5.3: Refunds + Recovery ----------

export interface AdminRefundRow {
  id: string;
  order_id: string;
  order_number: string | null;
  user_id: string | null;
  user_email_masked: string | null;
  status: string;
  amount_fils: number;
  reason: string | null;
  provider_reference: string | null;
  provider_refund_order_id: string | null;
  provider_submission_state: string | null;
  requested_at: string;
  processed_at: string | null;
  next_check_after: string | null;
  last_checked_at: string | null;
}

export interface AdminRecoveryRow {
  kind: string;
  severity: "low" | "medium" | "high";
  order_id: string | null;
  order_number: string | null;
  order_status: string | null;
  refund_id: string | null;
  user_id: string | null;
  user_email_masked: string | null;
  age_seconds: number;
  last_activity_at: string | null;
  last_checked_at: string | null;
  reason: string;
  meta: Record<string, unknown>;
}

export function useAdminRefunds(params: RefundsListParams) {
  return useQuery({
    queryKey: adminCommerceKeys.refundsList(params),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("v2_admin_list_refunds", {
        p_status: params.status ?? undefined,
        p_search: params.search ?? undefined,
        p_date_from: params.dateFrom ?? undefined,
        p_date_to: params.dateTo ?? undefined,
        p_limit: params.limit ?? 50,
        p_offset: params.offset ?? 0,
      });
      if (error) throw error;
      return unwrap<PagedResult<AdminRefundRow>>(data);
    },
    staleTime: 15_000,
  });
}

export function useAdminRefundDetail(refundId: string | null) {
  return useQuery({
    queryKey: adminCommerceKeys.refundDetail(refundId),
    enabled: !!refundId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("v2_admin_get_refund_detail", {
        p_refund_id: refundId!,
      });
      if (error) throw error;
      return data as Record<string, unknown>;
    },
  });
}

export function useAdminRefundableOrder(orderId: string | null) {
  return useQuery({
    queryKey: adminCommerceKeys.refundableOrder(orderId),
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("v2_admin_get_refundable_order", {
        p_order_id: orderId!,
      });
      if (error) throw error;
      return data as Record<string, unknown>;
    },
  });
}

export function useAdminRecovery(params: RecoveryListParams) {
  return useQuery({
    queryKey: adminCommerceKeys.recoveryList(params),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("v2_admin_list_recovery", {
        p_kind: params.kind ?? undefined,
        p_min_age_minutes: params.minAgeMinutes ?? 0,
        p_limit: params.limit ?? 100,
        p_offset: params.offset ?? 0,
      });
      if (error) throw error;
      return unwrap<PagedResult<AdminRecoveryRow>>(data);
    },
    staleTime: 15_000,
  });
}

export function useAdminRecoveryCounts() {
  return useQuery({
    queryKey: adminCommerceKeys.recoveryCounts(),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("v2_admin_recovery_counts");
      if (error) throw error;
      return data as { total: number; by_kind: Record<string, number> };
    },
    staleTime: 30_000,
  });
}

// ---------- Refund mutation invocations (v2-upayments-refund) ----------

export type RefundInvokeError =
  | "provider_disabled"
  | "insufficient_permissions"
  | "invalid_body"
  | "not_eligible"
  | "duplicate_idempotency_key"
  | "server_error"
  | "unknown_error"
  | string;

interface CreateRefundArgs {
  order_id: string;
  idempotency_key: string;
  allocations: { order_item_id: string; amount_fils: number }[];
  reason?: string;
}

export function useCreateRefundRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateRefundArgs) => {
      const { data, error } = await supabase.functions.invoke("v2-upayments-refund", {
        body: { action: "create", ...args },
      });
      if (error) {
        const code = await extractInvokeErrorCode(null, error);
        throw new Error(code ?? "unknown_error");
      }
      return data as { refund_id?: string; ok?: boolean; error?: string; [k: string]: unknown };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "refunds"] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "recovery"] });
    },
  });
}

export function useCheckRefundStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (refund_id: string) => {
      const { data, error } = await supabase.functions.invoke("v2-upayments-refund", {
        body: { action: "status", refund_id },
      });
      if (error) {
        const code = await extractInvokeErrorCode(null, error);
        throw new Error(code ?? "unknown_error");
      }
      return data as Record<string, unknown>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "refunds"] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "recovery"] });
    },
  });
}

export function useCheckPaymentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (order_id: string) => {
      const { data, error } = await supabase.functions.invoke("v2-upayments-status", {
        body: { order_id },
      });
      if (error) {
        const code = await extractInvokeErrorCode(null, error);
        throw new Error(code ?? "unknown_error");
      }
      return data as Record<string, unknown>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "recovery"] });
    },
  });
}

// ---------- Phase 6A.3: read-only legacy access migration preview ----------
export interface MigrationPreviewCatalog {
  legacy_prompt_count: number;
  matched_resource_count: number;
  legacy_version_count: number;
  legacy_product_count: number;
  unmatched_legacy_prompt_count: number;
}
export interface MigrationPreviewCollections {
  chatgpt_prompts: number;
  midjourney_prompts: number;
  unmatched_or_ambiguous: number;
}
export interface MigrationPreviewSubRow {
  tier: string; is_lifetime: boolean; status: string;
  count: number; expired: number; active_or_perpetual: number;
  proposed_scope: string;
}
export interface MigrationPreviewSubscriptions {
  rows: MigrationPreviewSubRow[];
  total_subscriptions: number;
  distinct_users: number;
}
export interface MigrationPreviewPayPal {
  classification: string;
  conversion_rate_fils_per_usd: number;
  rounding: string;
  per_user_cap_fils: number;
  total_count: number;
  by_status: Array<{ status: string; n: number; usd_total: number; fils_total: number }>;
  proposed_credit_fils_completed_precap: number;
  zero_amount_count: number;
  missing_subscription_link: number;
  duplicate_provider_reference_groups: number;
}
export interface MigrationPreviewUPayInterp {
  conversion: string;
  completed_capped_credit_fils: number;
  users_with_credit: number;
}
export interface MigrationPreviewUPayments {
  ambiguity_note: string;
  total_count: number;
  completed_count: number;
  raw_value_total: number;
  interpretation_A_values_as_KWD: MigrationPreviewUPayInterp;
  interpretation_B_values_as_legacy_USD: MigrationPreviewUPayInterp;
  threshold_users: {
    reach_on_paypal_only: number;
    reach_only_if_upayments_kwd: number;
    reach_only_if_upayments_legacy_usd: number;
    ambiguous_outcome_users: number;
  };
  duplicate_provider_reference_groups: number;
}
export interface MigrationPreviewEntitlements {
  by_scope: Record<string, number>;
  by_collection_key_active: Record<string, number>;
  by_collection_key_expired: Record<string, number>;
  active_total: number;
  expired_total: number;
  unique_users_active: number;
  unique_users_expired: number;
  cancelled_lifetime_flagged_users: number;
  by_source: Record<string, number>;
}
export interface MigrationPreviewCredits {
  source: string;
  users_with_credit: number;
  total_credit_fils: number;
  users_capped_at_threshold: number;
  threshold_fils: number;
  conversion_rate_fils_per_usd: number;
}
export interface MigrationPreviewAnomalies {
  missing_auth_users_for_subscriptions: number;
  missing_auth_users_for_transactions: number;
  transactions_without_subscription: number;
  subscriptions_without_transaction: number;
  subscriptions_with_missing_transaction: number;
  subscriptions_without_plan: number;
  duplicate_paypal_reference_groups: number;
  duplicate_upayments_reference_groups: number;
  zero_amount_paypal_completed: number;
  zero_amount_upayments_completed: number;
  unsupported_currencies: number;
  unsupported_gateways: number;
  transactions_status_mismatch_completed_zero: number;
  subscriptions_expired_but_status_active: number;
  cancelled_lifetime_users: number;
  ambiguous_upayments_amount_rows: number;
  unmatched_legacy_prompts: number;
}
export interface MigrationPreviewContractRule { rule: string; detail: string }
export interface MigrationPreviewGrantContract {
  note: string;
  rules: MigrationPreviewContractRule[];
}
export interface MigrationPreviewPlanCohorts {
  ultimate_active_lifetime_users: number;
  premium_active_lifetime_users: number;
  ultimate_cancelled_review_users: number;
  premium_cancelled_review_users: number;
  basic_active_users: number;
  standard_active_users: number;
  basic_expired_historical_users: number;
  standard_expired_historical_users: number;
  basic_cancelled_review_users: number;
  standard_cancelled_review_users: number;
  raw_row_counts_by_tier_status: Array<{
    tier: string; is_lifetime: boolean; status: string; rows: number;
  }>;
}
export interface GrandfatheringPolicyPlan {
  plan: "basic" | "standard" | "premium" | "ultimate";
  price_usd: number;
  duration: string;
  is_lifetime: boolean;
  original_promise: string;
  proposed_v2_scope: string;
  expiry_treatment: string;
}
export interface GrandfatheringPolicy {
  version: string;
  lifetime_threshold_fils: number;
  lifetime_threshold_kwd: number;
  conversion_rate_fils_per_usd: number;
  library_scope_includes: string[];
  library_scope_excludes: string[];
  active_definition: string;
  expired_definition: string;
  cancelled_treatment: string;
  lifetime_credit_rules: Record<string, string>;
  no_execute_rpc: boolean;
  plans: GrandfatheringPolicyPlan[];
  copy: {
    en: Record<string, string>;
    ar: Record<string, string>;
  };
}
export interface MigrationPreview {
  generated_at: string;
  conversion_rate_fils_per_usd: number;
  threshold_fils: number;
  execute_enabled: boolean;
  execution_blockers: string[];
  catalog: MigrationPreviewCatalog;
  collections: MigrationPreviewCollections;
  unmatched_sample: Array<{ resource_id: string; resource_type: string; slug: string; legacy_prompt_type: string | null }>;
  subscriptions: MigrationPreviewSubscriptions;
  plan_cohorts: MigrationPreviewPlanCohorts;
  transactions_paypal: MigrationPreviewPayPal;
  transactions_upayments: MigrationPreviewUPayments;
  proposed_entitlements: MigrationPreviewEntitlements;
  proposed_lifetime_credit: MigrationPreviewCredits;
  anomalies: MigrationPreviewAnomalies;
  grant_contract: MigrationPreviewGrantContract;
  grandfathering_policy: GrandfatheringPolicy;
}

export function useMigrationPreview() {
  return useQuery<MigrationPreview>({
    queryKey: ["admin", "v2", "migration-preview"],
    queryFn: async () => {
      // rpc name not yet in generated types; safe cast.
      const { data, error } = await (supabase as unknown as {
        rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
      }).rpc("v2_admin_migration_preview", {});
      if (error) throw error as Error;
      return data as MigrationPreview;
    },
    staleTime: 60_000,
  });
}

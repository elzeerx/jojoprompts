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
  scope: string;
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

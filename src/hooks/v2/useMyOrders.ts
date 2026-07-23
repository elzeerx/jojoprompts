import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Customer-safe order history/receipt reads via authenticated SECURITY DEFINER
 * RPCs. The RPCs use auth.uid() internally; no user id is trusted from the
 * client. They never expose payment_attempts, payment_events, or raw provider
 * payloads.
 */

export interface MyOrderSummary {
  id: string;
  order_number: string | null;
  status: string;
  currency: string;
  total_fils: number;
  paid_fils: number;
  refunded_fils: number;
  placed_at: string | null;
  settled_at: string | null;
  created_at: string;
  item_count: number;
}

export interface MyOrderReceiptItem {
  id: string;
  product_id: string | null;
  resource_id: string | null;
  quantity: number;
  unit_price_fils: number;
  line_total_fils: number;
  paid_allocation_fils: number | null;
  acquired_major_version: number | null;
  created_at: string;
  resource_slug: string | null;
  resource_type: string | null;
  title_en: string | null;
  title_ar: string | null;
  product_type: string | null;
}

export interface MyOrderReceiptRefund {
  id: string;
  status: string;
  amount_fils: number;
  reason: string | null;
  requested_at: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface MyOrderReceipt {
  order: {
    id: string;
    order_number: string | null;
    status: string;
    currency: string;
    subtotal_fils: number;
    discount_fils: number;
    discount_code: string | null;
    total_fils: number;
    paid_fils: number;
    lifetime_credit_applied_fils: number | null;
    placed_at: string | null;
    settled_at: string | null;
    created_at: string;
  };
  items: MyOrderReceiptItem[];
  refunds: MyOrderReceiptRefund[];
}

export function useMyOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["v2", "my-orders", user?.id ?? "anon"],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async (): Promise<MyOrderSummary[]> => {
      const { data, error } = await (supabase as any).rpc("v2_get_my_orders", {
        p_limit: 50,
        p_offset: 0,
      });
      if (error) throw error;
      const payload = (data ?? {}) as { ok?: boolean; orders?: MyOrderSummary[] };
      if (!payload.ok) throw new Error("orders_unavailable");
      return payload.orders ?? [];
    },
  });
}

export function useMyOrderDetail(orderId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["v2", "my-order", orderId, user?.id ?? "anon"],
    enabled: !!user && !!orderId,
    staleTime: 10_000,
    queryFn: async (): Promise<MyOrderReceipt> => {
      const { data, error } = await (supabase as any).rpc("v2_get_my_order_receipt", {
        p_order_id: orderId,
      });
      if (error) throw error;
      const payload = (data ?? {}) as {
        ok?: boolean;
        error?: string;
        order?: MyOrderReceipt["order"];
        items?: MyOrderReceiptItem[];
        refunds?: MyOrderReceiptRefund[];
      };
      if (!payload.ok || !payload.order) {
        throw new Error(payload.error ?? "receipt_unavailable");
      }
      return {
        order: payload.order,
        items: payload.items ?? [],
        refunds: payload.refunds ?? [],
      };
    },
  });
}

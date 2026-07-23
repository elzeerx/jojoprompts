import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Customer-safe order history read via RLS (`orders_owner_read`).
 * Only exposes safe fields; no payment_events, no raw provider payloads.
 */
export function useMyOrders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["v2", "my-orders", user?.id ?? "anon"],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, currency, total_fils, paid_fils, placed_at, settled_at, created_at, order_items:order_items(id, product_id, quantity, line_total_fils, product_snapshot)",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyOrderDetail(orderId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["v2", "my-order", orderId, user?.id ?? "anon"],
    enabled: !!user && !!orderId,
    staleTime: 10_000,
    queryFn: async () => {
      const [{ data: order, error }, { data: items }, { data: refunds }] =
        await Promise.all([
          supabase
            .from("orders")
            .select(
              "id, status, currency, total_fils, paid_fils, placed_at, settled_at, created_at",
            )
            .eq("id", orderId!)
            .maybeSingle(),
          supabase
            .from("order_items")
            .select("id, product_id, quantity, line_total_fils, product_snapshot")
            .eq("order_id", orderId!),
          supabase
            .from("refunds")
            .select("id, status, amount_fils, currency, created_at, processed_at")
            .eq("order_id", orderId!),
        ]);
      if (error) throw error;
      return { order, items: items ?? [], refunds: refunds ?? [] };
    },
  });
}

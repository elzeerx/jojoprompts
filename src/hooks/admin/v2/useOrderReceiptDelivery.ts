/**
 * Admin-only read hook for the V2 order receipt-delivery row associated
 * with a single order. Uses the standard authenticated Supabase client;
 * access is gated by the RLS policy `admin_read_receipt_deliveries` on
 * `public.v2_order_receipt_deliveries` (SELECT for authenticated admins).
 *
 * Never mutates. Admin-triggered resends are handled by the SEPARATE
 * audited flow in `useOrderReceiptResends` (see
 * `docs/security/RECEIPT_RESEND_BLOCKER.md` for the architecture). The
 * original delivery row is never reopened or rewritten from the client.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrderReceiptDelivery {
  id: string;
  order_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  sent_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  next_attempt_at: string;
  provider_message_id: string | null;
  updated_at: string;
}

export function useOrderReceiptDelivery(orderId: string | null) {
  return useQuery<OrderReceiptDelivery | null>({
    queryKey: ["admin", "order-receipt-delivery", orderId],
    enabled: !!orderId,
    staleTime: 15_000,
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from("v2_order_receipt_deliveries")
        .select(
          "id, order_id, status, attempts, max_attempts, sent_at, last_error_code, last_error_message, next_attempt_at, provider_message_id, updated_at",
        )
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) throw error;
      return (data as OrderReceiptDelivery | null) ?? null;
    },
  });
}

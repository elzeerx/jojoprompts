/**
 * Admin hooks for the audited order-receipt-resend flow.
 *
 * - `useOrderReceiptResendRequests(orderId)` — read-only list of previous
 *   resend attempts for an order (admin RLS SELECT).
 * - `useAdminResendOrderReceipt()` — mutation that invokes the
 *   `v2-admin-resend-order-receipt` Edge Function with ONLY
 *   `{ order_id, reason }`. Never sends recipient/amount/items overrides.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { extractInvokeErrorCode } from "@/lib/v2/invokeErrors";

export interface OrderReceiptResendRequest {
  id: string;
  order_id: string;
  requested_by: string | null;
  reason: string;
  status: "pending" | "processing" | "sent" | "failed";
  provider_message_id: string | null;
  error_code: string | null;
  error_message: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export function useOrderReceiptResendRequests(orderId: string | null) {
  return useQuery<OrderReceiptResendRequest[]>({
    queryKey: ["admin", "v2", "order-receipt-resends", orderId],
    enabled: !!orderId,
    staleTime: 15_000,
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (k: string, v: string) => {
              order: (
                k: string,
                o: { ascending: boolean },
              ) => {
                limit: (n: number) => Promise<{
                  data: OrderReceiptResendRequest[] | null;
                  error: { message: string } | null;
                }>;
              };
            };
          };
        };
      })
        .from("v2_order_receipt_resend_requests")
        .select(
          "id, order_id, requested_by, reason, status, provider_message_id, error_code, error_message, requested_at, started_at, completed_at, updated_at",
        )
        .eq("order_id", orderId)
        .order("requested_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export interface ResendReceiptInput {
  orderId: string;
  reason: string;
}

export interface ResendReceiptResult {
  ok: boolean;
  request_id?: string;
  provider_message_id?: string | null;
  error?: string;
}

export function useAdminResendOrderReceipt() {
  const qc = useQueryClient();
  return useMutation<ResendReceiptResult, Error, ResendReceiptInput>({
    mutationFn: async ({ orderId, reason }) => {
      const trimmed = (reason ?? "").trim();
      if (!orderId || trimmed.length < 3 || trimmed.length > 300) {
        throw new Error("invalid_reason");
      }
      const { data, error } = await supabase.functions.invoke(
        "v2-admin-resend-order-receipt",
        { body: { order_id: orderId, reason: trimmed } },
      );
      if (error) {
        const code = await extractInvokeErrorCode(data, error);
        throw new Error(code || error.message || "resend_failed");
      }
      return (data ?? { ok: false }) as ResendReceiptResult;
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "orders", "detail", vars.orderId] });
      qc.invalidateQueries({ queryKey: ["admin", "order-receipt-delivery", vars.orderId] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "order-receipt-resends", vars.orderId] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "orders"] });
    },
  });
}

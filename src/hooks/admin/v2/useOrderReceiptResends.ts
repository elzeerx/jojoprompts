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
import { ADMIN_RECEIPT_RESEND_ENABLED } from "@/config/v2Flags";

export interface OrderReceiptResendRequest {
  id: string;
  order_id: string;
  requested_by: string | null;
  reason: string;
  status: "pending" | "processing" | "reconciliation_required" | "sent" | "failed";
  provider_message_id: string | null;
  error_code: string | null;
  error_message: string | null;
  reconciliation_attempts: number;
  last_reconciliation_at: string | null;
  manual_resolution_note: string | null;
  manual_resolved_by: string | null;
  manual_resolved_at: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export function useOrderReceiptResendRequests(orderId: string | null) {
  return useQuery<OrderReceiptResendRequest[]>({
    queryKey: ["admin", "v2", "order-receipt-resends", orderId],
    enabled: !!orderId && ADMIN_RECEIPT_RESEND_ENABLED,
    staleTime: 15_000,
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("v2_order_receipt_resend_requests")
        .select(
          "id, order_id, requested_by, reason, status, provider_message_id, error_code, error_message, reconciliation_attempts, last_reconciliation_at, manual_resolution_note, manual_resolved_by, manual_resolved_at, requested_at, started_at, completed_at, updated_at",
        )
        .eq("order_id", orderId)
        .order("requested_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []) as OrderReceiptResendRequest[];
    },
    refetchInterval: (query) => {
      const rows = (query.state.data ?? []) as OrderReceiptResendRequest[];
      return rows.some((row) =>
        row.status === "pending" ||
        row.status === "processing" ||
        row.status === "reconciliation_required"
      )
        ? 30_000
        : false;
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
  resolution?: "sent" | "failed";
  error?: string;
}

export function useAdminResendOrderReceipt() {
  const qc = useQueryClient();
  return useMutation<ResendReceiptResult, Error, ResendReceiptInput>({
    mutationFn: async ({ orderId, reason }) => {
      if (!ADMIN_RECEIPT_RESEND_ENABLED) throw new Error("feature_unavailable");
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
      qc.invalidateQueries({ queryKey: ["admin", "v2", "audit"] });
    },
  });
}

export function useAdminReconcileOrderReceiptResend() {
  const qc = useQueryClient();
  return useMutation<ResendReceiptResult, Error, { requestId: string; orderId: string }>({
    mutationFn: async ({ requestId }) => {
      if (!ADMIN_RECEIPT_RESEND_ENABLED) throw new Error("feature_unavailable");
      if (!requestId) throw new Error("invalid_request_id");
      const { data, error } = await supabase.functions.invoke(
        "v2-admin-resend-order-receipt",
        { body: { request_id: requestId } },
      );
      if (error) {
        const code = await extractInvokeErrorCode(data, error);
        throw new Error(code || error.message || "reconciliation_failed");
      }
      return (data ?? { ok: false }) as ResendReceiptResult;
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "orders", "detail", vars.orderId] });
      qc.invalidateQueries({ queryKey: ["admin", "order-receipt-delivery", vars.orderId] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "order-receipt-resends", vars.orderId] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "audit"] });
    },
  });
}

export function useAdminResolveOrderReceiptResend() {
  const qc = useQueryClient();
  return useMutation<
    ResendReceiptResult,
    Error,
    {
      requestId: string;
      orderId: string;
      resolution: "sent" | "failed";
      reason: string;
    }
  >({
    mutationFn: async ({ requestId, resolution, reason }) => {
      if (!ADMIN_RECEIPT_RESEND_ENABLED) throw new Error("feature_unavailable");
      const trimmed = reason.trim();
      if (!requestId) throw new Error("invalid_request_id");
      if (trimmed.length < 3 || trimmed.length > 300) {
        throw new Error("invalid_reason");
      }
      const { data, error } = await supabase.functions.invoke(
        "v2-admin-resend-order-receipt",
        {
          body: {
            request_id: requestId,
            resolution,
            reason: trimmed,
          },
        },
      );
      if (error) {
        const code = await extractInvokeErrorCode(data, error);
        throw new Error(code || error.message || "manual_resolution_failed");
      }
      return (data ?? { ok: false }) as ResendReceiptResult;
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "orders", "detail", vars.orderId] });
      qc.invalidateQueries({ queryKey: ["admin", "order-receipt-delivery", vars.orderId] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "order-receipt-resends", vars.orderId] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "audit"] });
    },
  });
}

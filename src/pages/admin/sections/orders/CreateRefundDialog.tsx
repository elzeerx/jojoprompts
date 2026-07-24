import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useAdminRefundableOrder, useCreateRefundRequest,
} from "@/hooks/admin/v2/useAdminCommerce";
import { formatFils, bi } from "@/lib/v2/admin/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetOrderId?: string;
}

interface Item {
  id: string;
  resource_title: string | null;
  product_sku: string | null;
  paid_allocation_fils: number;
  already_refunded_fils: number;
  remaining_refundable_fils: number;
  active_entitlements: Array<{ id: string; scope: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeIdempotencyKey() {
  return `admin-refund-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Concise, safe error message for surfacing refundable-order lookup failures
 * in the destructive Alert. Never leak stack traces or PII; prefer known
 * Postgres/PostgREST error codes when present.
 */
export function formatRefundableLoadError(err: unknown): string {
  if (!err) return "Failed to load order";
  const e = err as { code?: string; message?: string };
  const code = typeof e.code === "string" && e.code.length <= 12 ? e.code : null;
  const raw = typeof e.message === "string" ? e.message : String(err);
  const msg = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
  return code ? `Failed to load order (${code}): ${msg}` : `Failed to load order: ${msg}`;
}

export function CreateRefundDialog({ open, onOpenChange, presetOrderId }: Props) {
  const [orderInput, setOrderInput] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [idemKey, setIdemKey] = useState<string>(makeIdempotencyKey());
  const [error, setError] = useState<string | null>(null);
  const [confirmStage, setConfirmStage] = useState(false);

  const refundable = useAdminRefundableOrder(orderId);
  const create = useCreateRefundRequest();

  useEffect(() => {
    if (open) {
      setError(null);
      setConfirmStage(false);
      setAllocations({});
      setReason("");
      setIdemKey(makeIdempotencyKey());
      if (presetOrderId) {
        setOrderInput(presetOrderId);
        setOrderId(presetOrderId);
      } else {
        setOrderInput("");
        setOrderId(null);
      }
    }
  }, [open, presetOrderId]);

  const orderData = (refundable.data ?? null) as
    | { order: { id: string; order_number: string; status: string; user_email: string | null }; items: Item[]; remaining_refundable_total_fils: number; eligible: boolean }
    | null;

  const totalRequestedFils = useMemo(() => {
    let sum = 0;
    for (const v of Object.values(allocations)) {
      const kwd = parseFloat(v || "0");
      if (Number.isFinite(kwd) && kwd > 0) sum += Math.round(kwd * 1000);
    }
    return sum;
  }, [allocations]);

  const activeAllocations = useMemo(() => {
    const out: { order_item_id: string; amount_fils: number }[] = [];
    for (const [itemId, v] of Object.entries(allocations)) {
      const kwd = parseFloat(v || "0");
      if (!Number.isFinite(kwd) || kwd <= 0) continue;
      const fils = Math.round(kwd * 1000);
      if (fils > 0) out.push({ order_item_id: itemId, amount_fils: fils });
    }
    return out;
  }, [allocations]);

  const lookup = async () => {
    setError(null);
    const trimmed = orderInput.trim();
    if (!trimmed) { setError("Enter an order # or UUID"); return; }
    if (UUID_RE.test(trimmed)) {
      // If the same id is entered again after a failure, force a refetch.
      if (orderId === trimmed) {
        void refundable.refetch();
      } else {
        setOrderId(trimmed);
      }
      return;
    }
    // Try order_number lookup via admin orders list search (RLS-scoped).
    const { data, error: rpcErr } = await supabase.rpc("v2_admin_list_orders", {
      p_search: trimmed, p_limit: 1, p_offset: 0,
    });
    if (rpcErr) { setError(formatRefundableLoadError(rpcErr)); return; }
    const rows = (data as { rows?: { id: string }[] } | null)?.rows ?? [];
    if (!rows.length) { setError("Order not found"); return; }
    const resolvedId = rows[0].id;
    if (orderId === resolvedId) {
      void refundable.refetch();
    } else {
      setOrderId(resolvedId);
    }
  };

  const validate = (): string | null => {
    if (!orderData) return "Load an order first";
    if (!orderData.eligible) return "Order is not eligible for refund";
    if (activeAllocations.length === 0) return "Enter at least one allocation amount";
    if (activeAllocations.length > 100) return "Too many allocation lines (max 100)";
    for (const a of activeAllocations) {
      const item = orderData.items.find((i) => i.id === a.order_item_id);
      if (!item) return "Invalid item";
      if (!Number.isInteger(a.amount_fils) || a.amount_fils <= 0) return "Amounts must be positive integer fils";
      if (a.amount_fils > item.remaining_refundable_fils) {
        return `Amount exceeds remaining refundable for ${item.resource_title ?? item.product_sku ?? "item"}`;
      }
    }
    return null;
  };

  const onSubmit = async () => {
    setError(null);
    const validation = validate();
    if (validation) { setError(validation); return; }
    if (!confirmStage) { setConfirmStage(true); return; }
    try {
      const res = await create.mutateAsync({
        order_id: orderData!.order.id,
        idempotency_key: idemKey,
        allocations: activeAllocations,
        reason: reason.trim() || undefined,
      });
      toast({ description: `Refund created: ${(res as { refund_id?: string }).refund_id ?? "OK"}` });
      onOpenChange(false);
    } catch (e) {
      const code = (e as Error)?.message ?? "unknown_error";
      if (code === "provider_disabled" || code === "configuration_unavailable") {
        setError("Payments unavailable — provider integration is disabled. No refund was created.");
      } else if (code === "insufficient_permissions") {
        setError("You do not have permission to create refunds.");
      } else {
        setError(`Refund failed: ${code}`);
      }
      setConfirmStage(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create refund / إنشاء استرداد</DialogTitle>
          <DialogDescription>
            Server-side allocations enforced in integer fils. Only provider-verified processed
            refunds revoke entitlements and reverse lifetime credit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Order # or ID</Label>
            <div className="flex gap-2 mt-1">
              <Input
                className="min-h-[44px]"
                value={orderInput}
                onChange={(e) => setOrderInput(e.target.value)}
                placeholder="e.g. JP-2026-000042 or UUID"
              />
              <Button variant="outline" className="min-h-[44px]" onClick={lookup}>Load</Button>
            </div>
          </div>

          {(refundable.isLoading || (refundable.isFetching && !orderData)) && (
            <div className="space-y-2" aria-live="polite">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {refundable.isError && !refundable.isFetching && (
            <Alert variant="destructive">
              <AlertTitle>Could not load order</AlertTitle>
              <AlertDescription>{formatRefundableLoadError(refundable.error)}</AlertDescription>
            </Alert>
          )}

          {orderData && (
            <>
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="font-mono">{orderData.order.order_number}</span>
                  <span className="text-xs text-muted-foreground">{orderData.order.status}</span>
                </div>
                <div className="text-xs text-muted-foreground">{orderData.order.user_email ?? "—"}</div>
                <div className="text-xs">
                  Refundable remaining: <strong>{formatFils(orderData.remaining_refundable_total_fils)}</strong>
                </div>
                {!orderData.eligible && (
                  <div className="text-xs text-destructive">
                    Not eligible: order status must be paid or partially_refunded with remaining allocation.
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {orderData.items.map((it) => (
                  <div key={it.id} className="rounded-md border p-3 text-sm">
                    <div className="flex justify-between">
                      <div>
                        <div className="font-medium">{it.resource_title ?? it.product_sku ?? "Item"}</div>
                        <div className="text-xs text-muted-foreground">
                          Paid {formatFils(it.paid_allocation_fils)} · Refunded {formatFils(it.already_refunded_fils)} ·
                          Remaining <strong>{formatFils(it.remaining_refundable_fils)}</strong>
                        </div>
                      </div>
                      <div className="w-32">
                        <Input
                          type="number" step="0.001" min="0"
                          className="min-h-[44px] text-right"
                          placeholder="0.000"
                          disabled={it.remaining_refundable_fils === 0}
                          value={allocations[it.id] ?? ""}
                          onChange={(e) =>
                            setAllocations((prev) => ({ ...prev, [it.id]: e.target.value }))
                          }
                        />
                        <div className="text-[10px] text-right text-muted-foreground mt-1">KWD</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <Label className="text-xs">Reason (optional, ≤255 chars)</Label>
                <Input
                  className="min-h-[44px] mt-1" maxLength={255}
                  value={reason} onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="text-sm flex justify-between">
                <span>Total to refund:</span>
                <strong>{formatFils(totalRequestedFils)}</strong>
              </div>

              {confirmStage && (
                <Alert>
                  <AlertTitle>Confirm refund</AlertTitle>
                  <AlertDescription className="text-xs">
                    Submitting to the provider. If (and only if) the provider verifies the refund as
                    processed, the corresponding item entitlement will be revoked and any lifetime
                    credit from that allocation will be reversed. Pending or failed refunds do not
                    revoke entitlements or reverse credit.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
            {bi("close")}
          </Button>
          <Button
            onClick={onSubmit} className="min-h-[44px]"
            disabled={!orderData || !orderData.eligible || activeAllocations.length === 0 || create.isPending}
          >
            {confirmStage ? "Confirm and submit" : "Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

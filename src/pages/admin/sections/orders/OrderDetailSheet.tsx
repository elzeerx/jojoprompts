import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  Copy,
  MailPlus,
  Printer,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAdminOrderDetail } from "@/hooks/admin/v2/useAdminCommerce";
import { useOrderReceiptDelivery } from "@/hooks/admin/v2/useOrderReceiptDelivery";
import { ADMIN_RECEIPT_RESEND_ENABLED } from "@/config/v2Flags";
import {
  useAdminReconcileOrderReceiptResend,
  useAdminResolveOrderReceiptResend,
  useAdminResendOrderReceipt,
  useOrderReceiptResendRequests,
} from "@/hooks/admin/v2/useOrderReceiptResends";
import { formatFils, formatDateTime, statusTone, copyToClipboard, bi } from "@/lib/v2/admin/format";

const DEFAULT_RESEND_REASON = "Customer requested another copy";
const RESEND_ELIGIBLE_STATUSES = new Set(["paid", "partially_refunded"]);
const RESEND_ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Your account is not allowed to resend receipts.",
  order_not_found: "This order no longer exists.",
  order_not_eligible: "Only paid or partially-refunded orders can be resent.",
  missing_recipient: "The customer account has no deliverable email address.",
  pending_exists: "A receipt resend is already pending for this order.",
  cooldown_active: "Please wait five minutes before sending another copy.",
  order_cap_exceeded: "This order reached its 24-hour resend limit.",
  admin_cap_exceeded: "Your account reached its 24-hour resend limit.",
  order_load_failed: "The canonical order or recipient could not be loaded.",
  resend_send_failed: "The email provider could not send the receipt.",
  claim_failed: "The resend request was created but could not be claimed. Review the history before retrying.",
  claim_lost: "Another process already claimed this resend request.",
  resend_request_failed: "The resend request could not be created.",
  reconciliation_claim_failed: "The ambiguous resend could not be claimed for reconciliation.",
  reconciliation_not_required: "This resend no longer needs reconciliation.",
  request_still_processing: "The original send is still processing. Try reconciliation after two minutes.",
  reconciliation_window_expired: "The provider's 24-hour idempotency window is nearly over. Review this delivery manually.",
  reconciliation_attempt_cap_exceeded: "This resend reached the safe reconciliation-attempt limit.",
  payload_snapshot_missing: "The exact saved email payload is unavailable. No provider retry was made.",
  payload_snapshot_failed: "The exact email payload could not be saved, so the receipt was not sent.",
  manual_resolution_failed: "This request could not be closed from its current state.",
  feature_unavailable: "Receipt resend is waiting for backend activation.",
};

function resendErrorMessage(code: string | undefined): string {
  if (!code) return "The receipt could not be resent.";
  return RESEND_ERROR_MESSAGES[code] ?? code.replaceAll("_", " ");
}

interface Props {
  orderId: string | null;
  onOpenChange: (open: boolean) => void;
}

interface OrderCore {
  id: string;
  order_number: string;
  status: string;
  currency: string;
  subtotal_fils: number;
  discount_fils: number;
  discount_code: string | null;
  total_fils: number;
  paid_fils: number;
  lifetime_credit_applied_fils: number;
  provider: string | null;
  provider_reference: string | null;
  idempotency_key: string | null;
  placed_at: string | null;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
}

interface Item {
  id: string;
  product_id: string | null;
  resource_id: string | null;
  quantity: number;
  unit_price_fils: number;
  line_total_fils: number;
  paid_allocation_fils: number | null;
  resource_version_id: string | null;
  acquired_major_version: number | null;
  product_sku: string | null;
  product_type: string | null;
  resource_title: string | null;
  resource_type: string | null;
}

interface Attempt {
  id: string;
  provider: string;
  status: string;
  merchant_reference: string | null;
  track_id: string | null;
  session_id: string | null;
  provider_order_id: string | null;
  expected_amount_fils: number | null;
  currency: string | null;
  provider_submission_state: string | null;
  last_provider_http_status: number | null;
  last_checked_at: string | null;
  next_check_after: string | null;
  check_count: number | null;
  created_at: string;
  updated_at: string;
}

interface Event {
  id: string;
  provider: string;
  event_type: string;
  external_event_id: string | null;
  amount_fils: number | null;
  currency: string | null;
  received_at: string;
}

interface RefundEntry {
  id: string;
  status: string;
  amount_fils: number;
  reason: string | null;
  provider_reference: string | null;
  provider_refund_order_id: string | null;
  provider_submission_state: string | null;
  requested_at: string;
  processed_at: string | null;
  items: Array<{ order_item_id: string; amount_fils: number }>;
}

interface Entitlement {
  id: string;
  scope: string;
  resource_id: string | null;
  grant_reason: string;
  source_order_item_id: string | null;
  granted_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  expires_at: string | null;
  version_major: number | null;
}

interface Credit {
  id: string;
  amount_fils: number;
  reason: string;
  refund_id: string | null;
  occurred_at: string;
}

interface Activity {
  id: string;
  action: string;
  actor_type: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
}

interface Detail {
  order: OrderCore;
  items: Item[];
  attempts: Attempt[];
  events: Event[];
  refunds: RefundEntry[];
  entitlements: Entitlement[];
  lifetime_credit: Credit[];
  activity: Activity[];
}

function CopyBtn({ text, label }: { text: string | null | undefined; label: string }) {
  if (!text) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={async () => {
        const ok = await copyToClipboard(text);
        toast({ description: ok ? `Copied ${label}` : "Copy failed" });
      }}
      aria-label={`Copy ${label}`}
    >
      <Copy className="h-3 w-3" />
    </Button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="rounded-md border bg-card">{children}</div>
    </section>
  );
}

export function OrderDetailSheet({ orderId, onOpenChange }: Props) {
  const query = useAdminOrderDetail(orderId);
  const detail = query.data as unknown as Detail | undefined;
  const receiptQuery = useOrderReceiptDelivery(orderId);
  const receipt = receiptQuery.data ?? null;
  const resendsQuery = useOrderReceiptResendRequests(orderId);
  const resends = useMemo(() => resendsQuery.data ?? [], [resendsQuery.data]);
  const resendMutation = useAdminResendOrderReceipt();
  const reconcileMutation = useAdminReconcileOrderReceiptResend();
  const resolveMutation = useAdminResolveOrderReceiptResend();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState(DEFAULT_RESEND_REASON);
  const [manualResolution, setManualResolution] = useState<{
    requestId: string;
    resolution: "sent" | "failed";
  } | null>(null);
  const [manualResolutionReason, setManualResolutionReason] = useState("");

  const orderStatus = detail?.order.status ?? null;
  const eligible = orderStatus ? RESEND_ELIGIBLE_STATUSES.has(orderStatus) : false;
  const activeResend = useMemo(
    () => resends.find((r) =>
      r.status === "pending" ||
      r.status === "processing" ||
      r.status === "reconciliation_required"
    ) ?? null,
    [resends],
  );
  const originalProcessing = !!receipt && receipt.status !== "sent" && receipt.status !== "failed";
  const reasonTrim = reason.trim();
  const reasonValid = reasonTrim.length >= 3 && reasonTrim.length <= 300;
  const resendUnavailable =
    !ADMIN_RECEIPT_RESEND_ENABLED ||
    !orderId ||
    !eligible ||
    !!activeResend ||
    originalProcessing ||
    resendMutation.isPending ||
    reconcileMutation.isPending ||
    resolveMutation.isPending;
  const resendConfirmDisabled = resendUnavailable || !reasonValid;

  const runResend = () => {
    if (!orderId || !reasonValid) return;
    resendMutation.mutate(
      { orderId, reason: reasonTrim },
      {
        onSuccess: (res) => {
          setConfirmOpen(false);
          if (res.ok) {
            toast({ description: "Receipt sent again / تمت إعادة إرسال الإيصال" });
          } else if (res.error === "reconciliation_required") {
            toast({
              variant: "destructive",
              title: "Reconciliation required",
              description: "Provider accepted the send but DB confirmation failed. Check history.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Resend failed",
              description: resendErrorMessage(res.error),
            });
          }
        },
        onError: (e) => {
          setConfirmOpen(false);
          toast({
            variant: "destructive",
            title: "Resend failed",
            description: resendErrorMessage((e as Error).message),
          });
        },
      },
    );
  };

  const runReconciliation = (requestId: string) => {
    if (!orderId) return;
    reconcileMutation.mutate(
      { requestId, orderId },
      {
        onSuccess: (res) => {
          if (res.ok) {
            toast({
              description: "Receipt delivery reconciled / تمت مطابقة إرسال الإيصال",
            });
          } else if (res.error === "reconciliation_required") {
            toast({
              variant: "destructive",
              title: "Still ambiguous",
              description: "The same safe request remains queued for reconciliation.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Reconciliation failed",
              description: resendErrorMessage(res.error),
            });
          }
        },
        onError: (e) => {
          toast({
            variant: "destructive",
            title: "Reconciliation failed",
            description: resendErrorMessage((e as Error).message),
          });
        },
      },
    );
  };

  const runManualResolution = () => {
    if (!orderId || !manualResolution) return;
    const trimmed = manualResolutionReason.trim();
    if (trimmed.length < 3 || trimmed.length > 300) return;
    const resolution = manualResolution.resolution;
    resolveMutation.mutate(
      {
        requestId: manualResolution.requestId,
        orderId,
        resolution,
        reason: trimmed,
      },
      {
        onSuccess: (res) => {
          setManualResolution(null);
          setManualResolutionReason("");
          if (res.ok) {
            toast({
              description: resolution === "sent"
                ? "Manual review recorded: receipt was sent."
                : "Manual review recorded: receipt was not sent.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "Resolution failed",
              description: resendErrorMessage(res.error),
            });
          }
        },
        onError: (e) => {
          toast({
            variant: "destructive",
            title: "Resolution failed",
            description: resendErrorMessage((e as Error).message),
          });
        },
      },
    );
  };


  return (
    <Sheet open={!!orderId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {detail ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{detail.order.order_number}</span>
                <Badge variant={statusTone(detail.order.status)}>{detail.order.status}</Badge>
                <CopyBtn text={detail.order.order_number} label="order number" />
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto min-h-[36px]"
                  onClick={() => window.print()}
                >
                  <Printer className="mr-1 h-3.5 w-3.5" /> Print
                </Button>
              </div>
            ) : (
              "Order / الطلب"
            )}
          </SheetTitle>
        </SheetHeader>

        {query.isLoading && (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        )}
        {query.isError && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {bi("error")}: {(query.error as Error).message}
          </div>
        )}

        {detail && (
          <div className="mt-4 space-y-4 text-sm">
            {/* Summary */}
            <Section title="Summary / الملخص">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 text-xs sm:grid-cols-3">
                <div><div className="text-muted-foreground">Customer</div><div>{detail.order.user_email ?? "—"}</div></div>
                <div><div className="text-muted-foreground">Name</div><div>{detail.order.user_name || "—"}</div></div>
                <div>
                  <div className="text-muted-foreground">Provider</div>
                  <div>{detail.order.provider ?? "—"}</div>
                </div>
                <div><div className="text-muted-foreground">Subtotal</div><div>{formatFils(detail.order.subtotal_fils)}</div></div>
                <div><div className="text-muted-foreground">Discount</div><div>{formatFils(detail.order.discount_fils)}{detail.order.discount_code ? ` (${detail.order.discount_code})` : ""}</div></div>
                <div><div className="text-muted-foreground">Total</div><div className="font-medium">{formatFils(detail.order.total_fils)}</div></div>
                <div><div className="text-muted-foreground">Paid</div><div>{formatFils(detail.order.paid_fils)}</div></div>
                <div><div className="text-muted-foreground">Lifetime credit</div><div>{formatFils(detail.order.lifetime_credit_applied_fils)}</div></div>
                <div><div className="text-muted-foreground">Created</div><div>{formatDateTime(detail.order.created_at)}</div></div>
                <div><div className="text-muted-foreground">Placed</div><div>{formatDateTime(detail.order.placed_at)}</div></div>
                <div><div className="text-muted-foreground">Settled</div><div>{formatDateTime(detail.order.settled_at)}</div></div>
                <div className="col-span-2 sm:col-span-3">
                  <div className="text-muted-foreground">Provider reference</div>
                  <div className="flex items-center gap-1 font-mono">{detail.order.provider_reference ?? "—"}<CopyBtn text={detail.order.provider_reference} label="ref" /></div>
                </div>
              </div>
            </Section>

            {/* Items */}
            <Section title="Items / العناصر">
              <div className="divide-y">
                {detail.items.length === 0 && <div className="p-3 text-xs text-muted-foreground">No items.</div>}
                {detail.items.map((it) => (
                  <div key={it.id} className="grid grid-cols-2 gap-2 p-3 text-xs sm:grid-cols-4">
                    <div className="col-span-2">
                      <div className="font-medium">{it.resource_title ?? it.product_sku ?? "—"}</div>
                      <div className="text-muted-foreground">{it.resource_type ?? it.product_type ?? ""} · qty {it.quantity} · v{it.acquired_major_version ?? "?"}</div>
                    </div>
                    <div><div className="text-muted-foreground">Unit</div><div>{formatFils(it.unit_price_fils)}</div></div>
                    <div><div className="text-muted-foreground">Line / paid</div><div>{formatFils(it.line_total_fils)} · {formatFils(it.paid_allocation_fils ?? 0)}</div></div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Entitlements granted */}
            <Section title="Entitlements granted / حقوق الوصول">
              <div className="divide-y">
                {detail.entitlements.length === 0 && <div className="p-3 text-xs text-muted-foreground">None.</div>}
                {detail.entitlements.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-2 p-3 text-xs">
                    <Badge variant="outline">{e.scope}</Badge>
                    <Badge variant="secondary">{e.grant_reason}</Badge>
                    <span className="text-muted-foreground">granted {formatDateTime(e.granted_at)}</span>
                    {e.revoked_at && <Badge variant="destructive">revoked {formatDateTime(e.revoked_at)}</Badge>}
                    {e.expires_at && <span className="text-muted-foreground">exp {formatDateTime(e.expires_at)}</span>}
                  </div>
                ))}
              </div>
            </Section>

            {/* Refunds */}
            <Section title="Refunds / المبالغ المستردة">
              <div className="divide-y">
                {detail.refunds.length === 0 && <div className="p-3 text-xs text-muted-foreground">No refunds.</div>}
                {detail.refunds.map((r) => (
                  <div key={r.id} className="space-y-1 p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusTone(r.status)}>{r.status}</Badge>
                      <span className="font-medium">{formatFils(r.amount_fils)}</span>
                      <span className="text-muted-foreground">requested {formatDateTime(r.requested_at)}</span>
                      {r.processed_at && <span className="text-muted-foreground">· processed {formatDateTime(r.processed_at)}</span>}
                    </div>
                    {r.reason && <div className="text-muted-foreground">{r.reason}</div>}
                    {r.items.length > 0 && (
                      <div className="text-muted-foreground">
                        {r.items.length} allocation line{r.items.length === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            {/* Lifetime credit ledger */}
            <Section title="Lifetime credit ledger / سجل الرصيد الدائم">
              <div className="divide-y">
                {detail.lifetime_credit.length === 0 && <div className="p-3 text-xs text-muted-foreground">No entries.</div>}
                {detail.lifetime_credit.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 text-xs">
                    <div>
                      <div className="font-medium">{c.amount_fils > 0 ? "+" : ""}{formatFils(c.amount_fils)}</div>
                      <div className="text-muted-foreground">{c.reason}</div>
                    </div>
                    <div className="text-muted-foreground">{formatDateTime(c.occurred_at)}</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Attempts + events timeline */}
            <Section title="Payment attempts / المحاولات">
              <div className="divide-y">
                {detail.attempts.length === 0 && <div className="p-3 text-xs text-muted-foreground">None.</div>}
                {detail.attempts.map((a) => (
                  <div key={a.id} className="space-y-1 p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusTone(a.status)}>{a.status}</Badge>
                      {a.provider_submission_state && <Badge variant="outline">{a.provider_submission_state}</Badge>}
                      {typeof a.last_provider_http_status === "number" && (
                        <span className="text-muted-foreground">HTTP {a.last_provider_http_status}</span>
                      )}
                      <span className="text-muted-foreground ml-auto">{formatDateTime(a.updated_at)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-muted-foreground sm:grid-cols-3">
                      {a.merchant_reference && <div className="font-mono truncate">mref: {a.merchant_reference}</div>}
                      {a.track_id && <div className="font-mono truncate">track: {a.track_id}</div>}
                      {a.session_id && <div className="font-mono truncate">session: {a.session_id}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Payment events / أحداث الدفع">
              <div className="divide-y">
                {detail.events.length === 0 && <div className="p-3 text-xs text-muted-foreground">None.</div>}
                {detail.events.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={statusTone(e.event_type)}>{e.event_type}</Badge>
                      <span className="text-muted-foreground">{e.provider}</span>
                      {typeof e.amount_fils === "number" && <span>{formatFils(e.amount_fils)}</span>}
                    </div>
                    <div className="text-muted-foreground">{formatDateTime(e.received_at)}</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Receipt delivery — audited admin resend via v2-admin-resend-order-receipt
                (see docs/security/RECEIPT_RESEND_BLOCKER.md). */}
            <Section title="Receipt delivery / حالة إرسال الإيصال">
              <div className="p-3 text-xs space-y-3" data-testid="order-receipt-delivery">
                {receiptQuery.isLoading && <Skeleton className="h-10 w-full" />}
                {!receiptQuery.isLoading && !receipt && (
                  <div className="text-muted-foreground">
                    No receipt-delivery record for this order.
                  </div>
                )}
                {receipt && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusTone(receipt.status)}>{receipt.status}</Badge>
                      <span className="text-muted-foreground">
                        attempt {receipt.attempts} / {receipt.max_attempts}
                      </span>
                      {receipt.sent_at && (
                        <span className="text-muted-foreground">
                          sent {formatDateTime(receipt.sent_at)}
                        </span>
                      )}
                      {!receipt.sent_at && receipt.status !== "sent" && (
                        <span className="text-muted-foreground">
                          next attempt {formatDateTime(receipt.next_attempt_at)}
                        </span>
                      )}
                    </div>
                    {receipt.provider_message_id && (
                      <div className="flex items-center gap-1 font-mono text-muted-foreground">
                        provider id: {receipt.provider_message_id}
                        <CopyBtn text={receipt.provider_message_id} label="provider id" />
                      </div>
                    )}
                    {receipt.last_error_code && (
                      <div className="text-destructive">
                        <span className="font-mono">{receipt.last_error_code}</span>
                        {receipt.last_error_message ? ` — ${receipt.last_error_message}` : ""}
                      </div>
                    )}
                  </>
                )}

                <div
                  className="border-t pt-3 space-y-2"
                  data-testid="order-receipt-resend"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-[44px]"
                      disabled={resendUnavailable}
                      onClick={() => setConfirmOpen(true)}
                      aria-label="Resend receipt / إعادة إرسال الإيصال"
                    >
                      <MailPlus className="mr-1 h-4 w-4" />
                      Resend receipt / إعادة إرسال الإيصال
                    </Button>
                    {!eligible && (
                      <span className="text-muted-foreground">
                        Only paid or partially-refunded orders are eligible.
                      </span>
                    )}
                    {!ADMIN_RECEIPT_RESEND_ENABLED && (
                      <span className="text-muted-foreground">
                        Receipt resend is waiting for backend activation.
                      </span>
                    )}
                    {eligible && activeResend && (
                      <span className="text-muted-foreground">
                        A resend is already {activeResend.status}.
                      </span>
                    )}
                    {eligible && !activeResend && originalProcessing && (
                      <span className="text-muted-foreground">
                        Original delivery still processing.
                      </span>
                    )}
                  </div>

                  {!ADMIN_RECEIPT_RESEND_ENABLED ? null : resendsQuery.isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : resends.length === 0 ? (
                    <div className="text-muted-foreground">
                      No previous resend attempts.
                    </div>
                  ) : (
                    <ul className="divide-y rounded border" data-testid="order-receipt-resend-history">
                      {resends.map((r) => {
                        const requestAgeMs = Date.now() - Date.parse(r.requested_at);
                        const processingAgeMs = Date.now() - Date.parse(r.updated_at);
                        const withinSafeWindow =
                          Number.isFinite(requestAgeMs) &&
                          requestAgeMs >= 0 &&
                          requestAgeMs < 23 * 60 * 60 * 1000;
                        const staleProcessing =
                          r.status === "processing" && processingAgeMs >= 2 * 60 * 1000;
                        const ambiguous =
                          r.status === "reconciliation_required" || staleProcessing;
                        const canReconcile =
                          withinSafeWindow &&
                          r.reconciliation_attempts < 5 &&
                          ambiguous;
                        const manualReviewRequired =
                          ambiguous &&
                          (!withinSafeWindow || r.reconciliation_attempts >= 5);
                        return (
                        <li key={r.id} className="p-2 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={statusTone(r.status)}>{r.status}</Badge>
                            <span className="text-muted-foreground">
                              requested {formatDateTime(r.requested_at)}
                            </span>
                            {r.completed_at && (
                              <span className="text-muted-foreground">
                                · completed {formatDateTime(r.completed_at)}
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground">{r.reason}</div>
                          {r.error_code && (
                            <div className="text-destructive">
                              <span className="font-mono">{r.error_code}</span>
                              {r.error_message ? ` — ${r.error_message}` : ""}
                            </div>
                          )}
                          {r.provider_message_id && (
                            <div className="flex items-center gap-1 font-mono text-muted-foreground">
                              provider id: {r.provider_message_id}
                              <CopyBtn text={r.provider_message_id} label="provider id" />
                            </div>
                          )}
                          {r.reconciliation_attempts > 0 && (
                            <div className="text-muted-foreground">
                              reconciliation attempts: {r.reconciliation_attempts} / 5
                            </div>
                          )}
                          {r.manual_resolution_note && (
                            <div className="text-muted-foreground">
                              manual review: {r.manual_resolution_note}
                              {r.manual_resolved_at
                                ? ` · ${formatDateTime(r.manual_resolved_at)}`
                                : ""}
                            </div>
                          )}
                          {canReconcile && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="min-h-[44px]"
                              disabled={reconcileMutation.isPending}
                              onClick={() => runReconciliation(r.id)}
                            >
                              <RefreshCw
                                className={`mr-1 h-4 w-4 ${
                                  reconcileMutation.isPending ? "animate-spin" : ""
                                }`}
                              />
                              Reconcile safely / مطابقة آمنة
                            </Button>
                          )}
                          {manualReviewRequired && (
                            <div className="space-y-2 rounded border border-amber-500/40 bg-amber-500/5 p-2 text-amber-800 dark:text-amber-200">
                              <div>
                                Automatic retry is disabled because the safe
                                idempotency window or attempt limit was reached.
                                Verify this request in Resend, then record the
                                result below.
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="min-h-[44px]"
                                  disabled={resolveMutation.isPending}
                                  onClick={() => {
                                    setManualResolution({
                                      requestId: r.id,
                                      resolution: "sent",
                                    });
                                    setManualResolutionReason("");
                                  }}
                                >
                                  <CheckCircle2 className="mr-1 h-4 w-4" />
                                  Mark sent
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="min-h-[44px]"
                                  disabled={resolveMutation.isPending}
                                  onClick={() => {
                                    setManualResolution({
                                      requestId: r.id,
                                      resolution: "failed",
                                    });
                                    setManualResolutionReason("");
                                  }}
                                >
                                  <XCircle className="mr-1 h-4 w-4" />
                                  Mark not sent
                                </Button>
                              </div>
                            </div>
                          )}
                        </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </Section>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Resend receipt / إعادة إرسال الإيصال
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    A new audited resend request will be created and the receipt will
                    be sent again to the customer on file. Only order data is
                    resent — recipient, items, and amount cannot be edited here.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <label
                    htmlFor="resend-reason"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Reason (3–300 chars) / السبب
                  </label>
                  <Textarea
                    id="resend-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={300}
                    rows={3}
                    className="min-h-[88px]"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="min-h-[44px]"
                    disabled={resendConfirmDisabled}
                    onClick={(e) => {
                      e.preventDefault();
                      runResend();
                    }}
                  >
                    {resendMutation.isPending ? "Sending…" : "Confirm resend"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
              open={!!manualResolution}
              onOpenChange={(open) => {
                if (!open) {
                  setManualResolution(null);
                  setManualResolutionReason("");
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Record provider review / تسجيل مراجعة المزود
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Only continue after checking this request in the Resend
                    dashboard. This closes the ambiguous request and is recorded
                    in admin activity.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <div className="rounded border bg-muted/30 p-2 text-sm">
                    Resolution:{" "}
                    <strong>
                      {manualResolution?.resolution === "sent"
                        ? "Receipt was sent"
                        : "Receipt was not sent"}
                    </strong>
                  </div>
                  <label
                    htmlFor="manual-receipt-resolution-reason"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Review note (3–300 chars) / ملاحظة المراجعة
                  </label>
                  <Textarea
                    id="manual-receipt-resolution-reason"
                    value={manualResolutionReason}
                    onChange={(e) => setManualResolutionReason(e.target.value)}
                    maxLength={300}
                    rows={3}
                    className="min-h-[88px]"
                    placeholder="What you verified in the provider dashboard"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel className="min-h-[44px]">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="min-h-[44px]"
                    disabled={
                      resolveMutation.isPending ||
                      manualResolutionReason.trim().length < 3 ||
                      manualResolutionReason.trim().length > 300
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      runManualResolution();
                    }}
                  >
                    {resolveMutation.isPending ? "Saving…" : "Record resolution"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>


            <Section title="Activity / النشاط">
              <div className="divide-y">
                {detail.activity.length === 0 && <div className="p-3 text-xs text-muted-foreground">None.</div>}
                {detail.activity.map((a) => (
                  <div key={a.id} className="p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{a.action}</span>
                      <span className="text-muted-foreground">{formatDateTime(a.created_at)}</span>
                    </div>
                    <div className="text-muted-foreground">by {a.actor_type}</div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Printer } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAdminOrderDetail } from "@/hooks/admin/v2/useAdminCommerce";
import { useOrderReceiptDelivery } from "@/hooks/admin/v2/useOrderReceiptDelivery";
import { formatFils, formatDateTime, statusTone, copyToClipboard, bi } from "@/lib/v2/admin/format";

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

            {/* Receipt delivery — truth-only, no admin resend (see docs/security/RECEIPT_RESEND_BLOCKER.md) */}
            <Section title="Receipt delivery / حالة إرسال الإيصال">
              <div className="p-3 text-xs space-y-2" data-testid="order-receipt-delivery">
                {receiptQuery.isLoading && (
                  <Skeleton className="h-10 w-full" />
                )}
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
                <p className="text-[11px] text-muted-foreground/80 border-t pt-2">
                  Admin resend is intentionally not exposed. The shared V2 delivery
                  pipeline’s claim RPC refuses to re-claim already-sent rows; a safe
                  resend requires a separate reviewed <code>service_role</code> RPC
                  and Edge Function. See <code>docs/security/RECEIPT_RESEND_BLOCKER.md</code>.
                </p>
              </div>
            </Section>

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

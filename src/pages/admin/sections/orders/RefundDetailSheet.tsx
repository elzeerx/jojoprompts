import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useAdminRefundDetail, useCheckRefundStatus,
} from "@/hooks/admin/v2/useAdminCommerce";
import {
  formatFils, formatDateTime, statusTone, copyToClipboard, bi,
} from "@/lib/v2/admin/format";

interface Props {
  refundId: string | null;
  onOpenChange: (open: boolean) => void;
}

interface RefundView {
  id: string;
  order_id: string;
  order_number: string | null;
  user_email: string | null;
  status: string;
  amount_fils: number;
  currency: string;
  reason: string | null;
  provider: string | null;
  provider_reference: string | null;
  provider_refund_order_id: string | null;
  provider_submission_state: string | null;
  last_provider_http_status: number | null;
  sanitized_provider_payload: Record<string, unknown> | null;
  requested_at: string;
  processed_at: string | null;
  next_check_after: string | null;
  last_checked_at: string | null;
  check_count: number | null;
}

export function RefundDetailSheet({ refundId, onOpenChange }: Props) {
  const { data, isLoading, refetch } = useAdminRefundDetail(refundId);
  const checkStatus = useCheckRefundStatus();
  const [cooldownError, setCooldownError] = useState<string | null>(null);

  const refund = (data?.refund ?? null) as RefundView | null;
  const items = (data?.items ?? []) as Array<{ order_item_id: string; amount_fils: number; resource_title: string | null; product_sku: string | null; paid_allocation_fils: number }>;
  const ents = (data?.entitlements ?? []) as Array<{ id: string; scope: string; resource_id: string | null; grant_reason: string; granted_at: string; revoked_at: string | null; revoke_reason: string | null }>;
  const credit = (data?.lifetime_credit ?? []) as Array<{ id: string; amount_fils: number; reason: string; occurred_at: string }>;
  const activity = (data?.activity ?? []) as Array<{ id: string; action: string; actor_type: string; created_at: string }>;

  const nextAllowedAt = useMemo(() => {
    if (!refund?.next_check_after) return null;
    const t = Date.parse(refund.next_check_after);
    return Number.isFinite(t) ? t : null;
  }, [refund?.next_check_after]);

  const now = Date.now();
  const cooldownRemaining = nextAllowedAt && nextAllowedAt > now ? Math.ceil((nextAllowedAt - now) / 1000) : 0;

  // Only permit a provider re-check when the refund is actually pollable:
  // status=approved + submitted + both provider IDs present. Anything else
  // (pending/submission_unknown, failed, missing provider IDs) will hit a
  // known-failing endpoint, so we disable the button and explain why.
  const isPollable =
    !!refund &&
    refund.status === "approved" &&
    refund.provider_submission_state === "submitted" &&
    !!refund.provider_reference &&
    !!refund.provider_refund_order_id;

  const recheckUnavailableReason = !refund ? null : (
    !isPollable
      ? (refund.status === "failed"
          ? "Refund terminal (failed) — provider re-check is not applicable."
          : refund.provider_submission_state === "submission_unknown"
            ? "Submission state is unknown — use the recovery queue to finalize or retry."
            : (!refund.provider_reference || !refund.provider_refund_order_id)
              ? "Provider identifiers missing — cannot poll /check-refund."
              : "Refund is not in a pollable state.")
      : null
  );

  const provPayload = (refund?.sanitized_provider_payload ?? {}) as Record<string, unknown>;
  const provHttpStatus = refund?.last_provider_http_status ?? (typeof provPayload["http_status"] === "number" ? provPayload["http_status"] as number : null);
  const provErrorCode = typeof provPayload["error_code"] === "string" ? provPayload["error_code"] as string : null;
  const provMessage = typeof provPayload["message"] === "string" ? provPayload["message"] as string : null;
  const hasProviderDiagnostics = !!(provHttpStatus || provErrorCode || provMessage || refund?.provider_submission_state);

  const onCheck = async () => {
    if (!refund) return;
    setCooldownError(null);
    try {
      await checkStatus.mutateAsync(refund.id);
      toast({ description: "Provider status refreshed" });
      refetch();
    } catch (e) {
      const code = (e as Error)?.message ?? "unknown_error";
      if (code === "provider_disabled" || code === "configuration_unavailable") {
        setCooldownError("Payments unavailable / المدفوعات غير متوفرة");
      } else if (code === "backoff_active" || code === "global_backoff") {
        setCooldownError("Backoff active — try again shortly / أعد المحاولة بعد قليل");
      } else {
        setCooldownError(code);
      }
    }
  };

  return (
    <Sheet open={!!refundId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto" side="right">
        <SheetHeader>
          <SheetTitle>Refund detail / تفاصيل الاسترداد</SheetTitle>
        </SheetHeader>

        {isLoading || !refund ? (
          <div className="space-y-3 py-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusTone(refund.status)}>{refund.status}</Badge>
              {refund.provider_submission_state && (
                <Badge variant="outline">submission: {refund.provider_submission_state}</Badge>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm" variant="outline" className="min-h-[44px]"
                  disabled={checkStatus.isPending || cooldownRemaining > 0 || !isPollable}
                  onClick={onCheck}
                  title={recheckUnavailableReason ?? undefined}
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  {cooldownRemaining > 0
                    ? `Retry in ${cooldownRemaining}s`
                    : "Re-check status"}
                </Button>
              </div>
            </div>

            {recheckUnavailableReason && (
              <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                {recheckUnavailableReason}
              </div>
            )}

            {cooldownError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {cooldownError}
              </div>
            )}

            {/* Provider response diagnostics (safe, sanitized only) */}
            {hasProviderDiagnostics && (
              <section>
                <h3 className="text-sm font-semibold mb-2">Provider response / استجابة المزود</h3>
                <div className="rounded-md border p-3 text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                  {refund.provider_submission_state && (
                    <>
                      <div className="text-muted-foreground">Submission state</div>
                      <div className="font-mono text-xs">{refund.provider_submission_state}</div>
                    </>
                  )}
                  {provHttpStatus != null && (
                    <>
                      <div className="text-muted-foreground">HTTP status</div>
                      <div className="font-mono text-xs">{provHttpStatus}</div>
                    </>
                  )}
                  {provErrorCode && (
                    <>
                      <div className="text-muted-foreground">Error code</div>
                      <div className="font-mono text-xs break-all">{provErrorCode}</div>
                    </>
                  )}
                  {provMessage && (
                    <>
                      <div className="text-muted-foreground">Message</div>
                      <div className="text-xs break-words">{provMessage}</div>
                    </>
                  )}
                </div>
              </section>
            )}


            {/* Core */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="text-muted-foreground">Order</div>
              <div className="font-mono">{refund.order_number ?? refund.order_id.slice(0, 8)}</div>
              <div className="text-muted-foreground">Customer</div>
              <div>{refund.user_email ?? "—"}</div>
              <div className="text-muted-foreground">Amount</div>
              <div>{formatFils(refund.amount_fils)}</div>
              <div className="text-muted-foreground">Reason</div>
              <div>{refund.reason ?? "—"}</div>
              <div className="text-muted-foreground">Provider ref</div>
              <div className="font-mono text-xs flex items-center gap-2">
                {refund.provider_reference ?? "—"}
                {refund.provider_reference && (
                  <Button
                    size="icon" variant="ghost" className="h-6 w-6"
                    onClick={async () => {
                      const ok = await copyToClipboard(refund.provider_reference!);
                      toast({ description: ok ? "Copied" : "Copy failed" });
                    }}
                    aria-label="Copy provider reference"
                  ><Copy className="h-3 w-3" /></Button>
                )}
              </div>
              <div className="text-muted-foreground">Refund order id</div>
              <div className="font-mono text-xs">{refund.provider_refund_order_id ?? "—"}</div>
              <div className="text-muted-foreground">Requested</div>
              <div>{formatDateTime(refund.requested_at)}</div>
              <div className="text-muted-foreground">Processed</div>
              <div>{formatDateTime(refund.processed_at)}</div>
              <div className="text-muted-foreground">Last checked</div>
              <div>{formatDateTime(refund.last_checked_at)}</div>
              <div className="text-muted-foreground">Next check after</div>
              <div>{formatDateTime(refund.next_check_after)}</div>
            </div>

            {/* Allocations */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Allocation lines</h3>
              <div className="rounded-md border">
                {items.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No allocations</div>
                ) : (
                  <ul className="divide-y">
                    {items.map((it) => (
                      <li key={it.order_item_id} className="p-3 text-sm flex justify-between">
                        <div>
                          <div className="font-medium">{it.resource_title ?? it.product_sku ?? "Item"}</div>
                          <div className="text-xs text-muted-foreground font-mono">{it.order_item_id.slice(0, 8)}</div>
                        </div>
                        <div className="text-right">
                          <div>{formatFils(it.amount_fils)}</div>
                          <div className="text-xs text-muted-foreground">of {formatFils(it.paid_allocation_fils)} paid</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Impact */}
            <section>
              <h3 className="text-sm font-semibold mb-2">
                Entitlement / credit impact {refund.status === "processed" ? "(applied)" : "(preview)"}
              </h3>
              <div className="text-xs text-muted-foreground mb-2">
                {refund.status === "processed"
                  ? "Processed refunds have revoked linked entitlements and reversed lifetime credit."
                  : "Only a provider-verified processed refund revokes the linked entitlement and reverses credit. Pending or failed refunds do not."}
              </div>
              <div className="rounded-md border p-3 space-y-2 text-sm">
                {ents.length === 0 && <div className="text-muted-foreground">No linked entitlements.</div>}
                {ents.map((e) => (
                  <div key={e.id} className="flex justify-between">
                    <div>
                      <div>{e.scope} · {e.grant_reason}</div>
                      <div className="text-xs text-muted-foreground font-mono">{e.id.slice(0, 8)}</div>
                    </div>
                    <div className="text-right">
                      <Badge variant={e.revoked_at ? "outline" : "default"}>
                        {e.revoked_at ? "revoked" : "active"}
                      </Badge>
                      {e.revoked_at && (
                        <div className="text-xs text-muted-foreground mt-1">{e.revoke_reason ?? ""}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {credit.length > 0 && (
                <div className="rounded-md border p-3 mt-2 text-sm">
                  <div className="text-xs font-semibold mb-1">Lifetime credit ledger</div>
                  {credit.map((c) => (
                    <div key={c.id} className="flex justify-between text-xs">
                      <span>{c.reason} · {formatDateTime(c.occurred_at)}</span>
                      <span className={c.amount_fils < 0 ? "text-destructive" : ""}>
                        {formatFils(c.amount_fils)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Activity */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Activity</h3>
              <div className="rounded-md border max-h-64 overflow-y-auto">
                {activity.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No activity events</div>
                ) : (
                  <ul className="divide-y text-xs">
                    {activity.map((a) => (
                      <li key={a.id} className="p-2 flex justify-between">
                        <span>{a.action} <span className="text-muted-foreground">({a.actor_type})</span></span>
                        <span className="text-muted-foreground">{formatDateTime(a.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

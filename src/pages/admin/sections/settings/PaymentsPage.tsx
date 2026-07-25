import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  ArrowRight,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/v2/admin/format";
import {
  useAdminPaymentSettingsStatus,
  useAdminPaymentSettingsSummary,
} from "@/hooks/admin/v2/useAdminPaymentSettings";
import { useReconciliationSummary } from "@/hooks/admin/v2/useAdminCommerce";
import {
  attentionTotal,
  isHealthy,
  periodLabel,
  readinessRows,
  type StatusTone,
} from "@/lib/v2/admin/paymentSettings";

function toneClass(tone: StatusTone): string {
  switch (tone) {
    case "ok": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "warn": return "bg-amber-100 text-amber-800 border-amber-200";
    case "danger": return "bg-red-100 text-red-800 border-red-200";
    case "info":
    default: return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-3 min-h-[68px] flex flex-col justify-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export const PAYMENTS_NAV_LINKS: { to: string; label: string; description: string }[] = [
  { to: "/admin/orders", label: "Orders", description: "Order-level detail & receipts" },
  { to: "/admin/orders/payment-events", label: "Payment events", description: "Provider event stream" },
  { to: "/admin/orders/entitlements", label: "Entitlements", description: "Granted entitlements" },
  { to: "/admin/orders/refunds", label: "Refunds", description: "Refund requests & processing" },
  { to: "/admin/orders/recovery", label: "Recovery queue", description: "Stalled/unsettled orders" },
  { to: "/admin/orders/discounts", label: "Discounts", description: "One-time payment discount codes" },
];

export const PAYMENTS_RECON_LINKS: Record<string, string> = {
  mismatches: "/admin/orders/payment-events",
  pending_past_due: "/admin/orders/recovery",
  paid_without_entitlement: "/admin/orders",
  credit_inconsistent: "/admin/orders/entitlements",
  duplicate_event_risk: "/admin/orders/payment-events",
  refund_alloc_over_item: "/admin/orders/refunds",
  refund_alloc_over_order: "/admin/orders/refunds",
  processed_missing_credit: "/admin/orders/refunds",
  processed_item_unrevoked_entitlement: "/admin/orders/refunds",
  threshold_lifetime_below_credit: "/admin/orders/entitlements",
};

export default function PaymentsPage() {
  const statusQ = useAdminPaymentSettingsStatus();
  const summaryQ = useAdminPaymentSettingsSummary();
  const reconQ = useReconciliationSummary();

  const rows = useMemo(
    () => (statusQ.data ? readinessRows(statusQ.data) : []),
    [statusQ.data],
  );

  const attention = attentionTotal(reconQ.data);
  const healthy = isHealthy(attention);

  const refreshing = statusQ.isFetching || summaryQ.isFetching || reconQ.isFetching;
  const refreshAll = () => {
    void statusQ.refetch();
    void summaryQ.refetch();
    void reconQ.refetch();
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CreditCard className="h-6 w-6" aria-hidden />
            Payments settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only operational overview. Use the linked queues for order,
            refund, and recovery actions.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={refreshAll}
          disabled={refreshing}
          className="min-h-[44px]"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Active gateway summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active gateway</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Provider</div>
            <div className="font-semibold">UPayments</div>
            <div className="text-xs text-muted-foreground mt-1">Hosted checkout</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Currency</div>
            <div className="font-semibold">KWD (authoritative in fils)</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Billing model</div>
            <div className="font-semibold">One-time payments</div>
            <div className="text-xs text-muted-foreground mt-1">Subscriptions disabled</div>
          </div>
          <div className="rounded-lg border p-3 sm:col-span-2 lg:col-span-3">
            <div className="text-xs text-muted-foreground">PayPal (legacy)</div>
            <div className="text-sm">
              Historical PayPal records retained read-only. No PayPal option in
              V2 checkout.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration readiness */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {statusQ.data?.configured ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
            )}
            Configuration
          </CardTitle>
          <Badge variant="outline" className="text-xs">Server-verified</Badge>
        </CardHeader>
        <CardContent>
          {statusQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : statusQ.isError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Unable to load configuration</AlertTitle>
              <AlertDescription>
                The admin status service did not respond. Retry, or check the
                Edge Function logs.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {rows.map((r) => (
                  <div
                    key={r.key}
                    className="flex items-center justify-between rounded-lg border p-3 gap-3"
                  >
                    <div className="text-sm">{r.label}</div>
                    <Badge className={`border ${toneClass(r.tone)}`} variant="outline">
                      {r.value}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                Services: {statusQ.data?.services.join(", ")}
              </div>
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>Secret changes</AlertTitle>
                <AlertDescription>
                  Provider secrets are managed in Supabase Edge Function
                  secrets. Updates require redeploying the affected functions.
                  Secret values are never displayed here.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Operational summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">UPayments operational summary</CardTitle>
          <Badge variant="outline" className="text-xs">
            Period: {summaryQ.data ? periodLabel(summaryQ.data.period) : "All time"}
          </Badge>
        </CardHeader>
        <CardContent>
          {summaryQ.isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : summaryQ.isError || !summaryQ.data ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Unable to load summary</AlertTitle>
              <AlertDescription>The summary service did not respond.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Orders
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  <Metric label="Total" value={summaryQ.data.orders.total} />
                  <Metric label="Paid" value={summaryQ.data.orders.paid} />
                  <Metric label="Failed" value={summaryQ.data.orders.failed} />
                  <Metric label="Pending" value={summaryQ.data.orders.pending} />
                  <Metric label="Refunded" value={summaryQ.data.orders.refunded} />
                  <Metric label="Partially refunded" value={summaryQ.data.orders.partially_refunded} />
                  <Metric label="Cancelled" value={summaryQ.data.orders.cancelled} />
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Payment attempts
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Metric label="Total" value={summaryQ.data.payment_attempts.total} />
                  <Metric label="Verified paid" value={summaryQ.data.payment_attempts.verified_paid} />
                  <Metric label="Failed attempts" value={summaryQ.data.payment_attempts.failed} />
                  <Metric label="Mismatch" value={summaryQ.data.payment_attempts.mismatch} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Payment events
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Metric label="Total" value={summaryQ.data.payment_events.total} />
                    <Metric
                      label="Latest event"
                      value={
                        summaryQ.data.payment_events.last_event_at
                          ? formatDateTime(summaryQ.data.payment_events.last_event_at)
                          : "—"
                      }
                    />
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Refunds
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Metric label="Total" value={summaryQ.data.refunds.total} />
                    <Metric label="Processed" value={summaryQ.data.refunds.processed} />
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                As of {formatDateTime(summaryQ.data.as_of)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reconciliation attention */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Reconciliation attention</CardTitle>
          {reconQ.isLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : attention === null ? (
            <Badge variant="outline" className={toneClass("warn")}>Unavailable</Badge>
          ) : (
            <Badge
              variant="outline"
              className={toneClass(healthy ? "ok" : "danger")}
            >
              {healthy ? "Healthy" : `${attention} finding${attention === 1 ? "" : "s"}`}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {reconQ.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : reconQ.isError || !reconQ.data ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Unable to load reconciliation</AlertTitle>
              <AlertDescription>Retry using the Refresh button above.</AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                { key: "mismatches", label: "Mismatches" },
                { key: "pending_past_due", label: "Stale pending" },
                { key: "paid_without_entitlement", label: "Paid without entitlement" },
                { key: "credit_inconsistent", label: "Credit inconsistency" },
                { key: "duplicate_event_risk", label: "Duplicate-event risk" },
                { key: "refund_alloc_over_item", label: "Refund over item" },
                { key: "refund_alloc_over_order", label: "Refund over order" },
                { key: "processed_missing_credit", label: "Processed w/o credit" },
                { key: "processed_item_unrevoked_entitlement", label: "Unrevoked entitlement" },
                { key: "threshold_lifetime_below_credit", label: "Lifetime below credit" },
              ].map((r) => {
                const to = PAYMENTS_RECON_LINKS[r.key] ?? "/admin/orders";
                const v = (reconQ.data as unknown as Record<string, number>)[r.key] ?? 0;
                const ok = v === 0;
                return (
                  <div
                    key={r.key}
                    className="flex items-center justify-between rounded-lg border p-3 gap-3 min-h-[64px]"
                  >
                    <div className="text-sm">{r.label}</div>
                    <div className="flex items-center gap-2">
                      <Badge className={`border ${toneClass(ok ? "ok" : "danger")}`} variant="outline">
                        {v}
                      </Badge>
                      {!ok && (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="min-h-[44px]"
                        >
                          <Link to={to} aria-label={`Open ${r.label}`}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operations</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {PAYMENTS_NAV_LINKS.map((n) => (
            <Button
              key={n.to}
              asChild
              variant="outline"
              className="h-auto min-h-[64px] justify-start text-left"
            >
              <Link to={n.to} className="flex flex-col items-start gap-1 py-2">
                <span className="font-medium flex items-center gap-1">
                  {n.label}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </span>
                <span className="text-xs text-muted-foreground">{n.description}</span>
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

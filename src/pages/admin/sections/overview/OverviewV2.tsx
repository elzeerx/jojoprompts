import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ClipboardCheck,
  FileEdit,
  Flag,
  Mail,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Wallet,
  Package,
  BarChart2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRecoveryCounts } from "@/hooks/admin/v2/useAdminCommerce";
import {
  formatDownloadsTile,
  formatDeliveryFailuresTile,
} from "@/lib/v2/admin/overviewKpiFormat";

function formatKWD(fils: number | null | undefined): string {
  if (fils == null) return "—";
  return `${(fils / 1000).toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} KWD`;
}

interface OverviewData {
  period_days: number;
  period_since: string;
  revenue_fils: number;
  paid_orders: number;
  failed_orders_period: number;
  downloads: { available: boolean; count?: number; unique_users?: number; reason?: string };
  active_entitlements: number;
  lifetime_purchase_count: number;
  lifetime_threshold_count: number;
  payment_success_count: number;
  payment_failure_count: number;
  payment_success_rate: number | null;
  refund_count: number;
  refund_denominator: number;
  refund_rate: number | null;
  delivery_failures: { available: boolean; count?: number; attempts?: number; reason?: string };
  total_resources: number;
  published_resources: number;
  attention: {
    drafts: number;
    review: number;
    scans: number;
    failed_payments: number;
    pending_refunds: number;
    open_reports: number;
  };
}

async function fetchOverview(periodDays: number): Promise<OverviewData> {
  const { data, error } = await (supabase as any).rpc("get_admin_v2_overview", {
    p_period_days: periodDays,
  });
  if (error) throw error;
  return data as OverviewData;
}

export default function OverviewV2() {
  const periodDays = 30;
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "v2", "overview", periodDays],
    queryFn: () => fetchOverview(periodDays),
    staleTime: 30_000,
  });
  const recoveryCounts = useAdminRecoveryCounts();

  const attention = [
    { key: "drafts", label: "Drafts", to: "/admin/publishing/drafts", icon: FileEdit, value: data?.attention.drafts },
    { key: "review", label: "Awaiting review", to: "/admin/publishing/review", icon: ClipboardCheck, value: data?.attention.review },
    { key: "scans", label: "Scans need action", to: "/admin/trust/scans", icon: ShieldCheck, value: data?.attention.scans },
    { key: "failed_payments", label: "Failed payments", to: "/admin/orders?status=failed", icon: ShoppingBag, value: data?.attention.failed_payments },
    { key: "pending_refunds", label: "Pending refunds", to: "/admin/orders/refunds?status=pending", icon: RotateCcw, value: data?.attention.pending_refunds },
    { key: "recovery", label: "Recovery queue", to: "/admin/orders/recovery", icon: ShieldAlert, value: recoveryCounts.data?.total },
    { key: "open_reports", label: "Open reports", to: "/admin/trust/reports", icon: Flag, value: data?.attention.open_reports },
    {
      key: "delivery_failures",
      label: "Delivery failures",
      to: "/admin/communications/delivery",
      icon: Mail,
      value: data?.delivery_failures?.available ? (data?.delivery_failures?.count ?? 0) : undefined,
    },
  ];

  interface Kpi { label: string; value: string; hint?: string; unavailable?: string }
  const kpis: Kpi[] = data
    ? [
        {
          label: `Revenue · ${periodDays}d`,
          value: formatKWD(data.revenue_fils),
          hint: `${data.paid_orders.toLocaleString()} paid orders`,
        },
        {
          label: `Paid orders · ${periodDays}d`,
          value: data.paid_orders.toLocaleString(),
          hint: `${data.failed_orders_period.toLocaleString()} failed in period`,
        },
        {
          label: "Active entitlements",
          value: data.active_entitlements.toLocaleString(),
        },
        {
          label: "Lifetime unlocks",
          value: (data.lifetime_purchase_count + data.lifetime_threshold_count).toLocaleString(),
          hint: `${data.lifetime_purchase_count} purchased · ${data.lifetime_threshold_count} threshold`,
        },
        {
          label: `Payment success rate · ${periodDays}d`,
          value: data.payment_success_rate == null ? "—" : `${data.payment_success_rate}%`,
          hint: `${data.payment_success_count} ok · ${data.payment_failure_count} fail`,
          unavailable:
            data.payment_success_rate == null
              ? "No payment events in period"
              : undefined,
        },
        {
          label: `Refund rate · ${periodDays}d`,
          value: data.refund_rate == null ? "—" : `${data.refund_rate}%`,
          hint: `${data.refund_count} refunds / ${data.refund_denominator} paid`,
          unavailable: data.refund_rate == null ? "No paid orders in period" : undefined,
        },
        {
          label: "Total resources",
          value: data.total_resources.toLocaleString(),
          hint: `${data.published_resources.toLocaleString()} published`,
        },
        formatDownloadsTile(data.downloads, periodDays),
        formatDeliveryFailuresTile(data.delivery_failures, periodDays),
      ]
    : Array.from({ length: 9 }).map(() => ({ label: "", value: "" }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-dark-base sm:text-2xl">Overview</h1>
          <p className="text-sm text-muted-foreground">
            All operational metrics come from <code>get_admin_v2_overview({periodDays})</code>.
            Fields labelled “Unavailable” are surfaced honestly — no invented zeros.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="min-h-[44px]">
            <Link to="/admin/publishing/new">
              <Package className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              New Resource
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="min-h-[44px]">
            <Link to="/admin/publishing/imports">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Import
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="min-h-[44px]">
            <Link to="/admin/publishing/review">
              <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Review Queue
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="min-h-[44px]">
            <Link to="/admin/orders/payment-events">
              <Wallet className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Reconcile Payments
            </Link>
          </Button>
        </div>
      </header>

      {isError ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
            <span>
              Failed to load overview: {(error as any)?.message ?? "unknown error"}
            </span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section aria-label="Attention required">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warm-gold" aria-hidden />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Attention Required
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {attention.map((a) => {
            const Icon = a.icon;
            const v = a.value;
            const isAlert = (v ?? 0) > 0;
            return (
              <Link
                key={a.key}
                to={a.to}
                aria-label={`${a.label}: ${v ?? "—"}`}
                className={`group flex h-[92px] flex-col justify-between rounded-lg border p-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-gold ${
                  isAlert
                    ? "border-warm-gold/60 bg-warm-gold/10 hover:bg-warm-gold/15"
                    : "border-gray-200 bg-white hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className={`h-4 w-4 ${isAlert ? "text-warm-gold" : "text-muted-foreground"}`} aria-hidden />
                  {isLoading || v == null ? (
                    <Skeleton className="h-5 w-8" />
                  ) : (
                    <span className={`text-lg font-semibold tabular-nums ${isAlert ? "text-dark-base" : "text-muted-foreground"}`}>
                      {v.toLocaleString()}
                    </span>
                  )}
                </div>
                <span className="text-[11px] leading-tight text-muted-foreground group-hover:text-dark-base line-clamp-2">
                  {isLoading ? <Skeleton className="h-3 w-24" /> : a.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-label="Key metrics">
        <div className="mb-2 flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Key Metrics · last {periodDays} days
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map((k, i) => (
            <Card key={i} className="h-[110px]">
              <CardHeader className="p-3 pb-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground leading-tight line-clamp-2 min-h-[28px]">
                  {isLoading ? <Skeleton className="h-3 w-24" /> : k.label}
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {isLoading ? (
                  <Skeleton className="h-5 w-20" />
                ) : k.unavailable ? (
                  <div>
                    <div className="text-sm italic text-muted-foreground">Unavailable</div>
                    <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground line-clamp-2">
                      {k.unavailable}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="truncate text-lg font-semibold tabular-nums text-dark-base">
                      {k.value}
                    </div>
                    {k.hint ? (
                      <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground line-clamp-2">
                        {k.hint}
                      </p>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ClipboardCheck,
  FileEdit,
  Flag,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  KeyRound,
  Wallet,
  Package,
  BarChart2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

/** Format integer fils as KWD with 3 decimals (spec: KWD authoritative). */
function formatKWD(fils: number | null | undefined): string {
  if (fils == null) return "Unavailable";
  return `${(fils / 1000).toLocaleString(undefined, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} KWD`;
}

interface Kpi {
  label: string;
  value: string;
  hint?: string;
  unavailable?: string;
}

interface Attention {
  key: string;
  label: string;
  count: number | null;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  reason?: string;
}

async function headCount(
  table: string,
  build?: (q: any) => any,
): Promise<number | null> {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (build) q = build(q);
  const { count, error } = await q;
  if (error) return null;
  return count ?? 0;
}

async function fetchOverview() {
  const now = new Date();
  const iso30dAgo = new Date(now.getTime() - 30 * 24 * 3600_000).toISOString();

  const [
    totalResources,
    publishedResources,
    drafts,
    review,
    activeEntitlements,
    lifetimeEntitlements,
    paidOrders30d,
    failedOrders,
    pendingRefunds,
    openReports,
    dirtyScans,
    revenueRows,
    recent,
  ] = await Promise.all([
    headCount("resources"),
    headCount("resources", (q) => q.eq("lifecycle", "published")),
    headCount("resources", (q) => q.eq("lifecycle", "draft")),
    headCount("resources", (q) => q.eq("lifecycle", "review")),
    headCount("entitlements", (q) => q.is("revoked_at", null)),
    headCount("entitlements", (q) =>
      q.eq("grant_reason", "lifetime_purchase").is("revoked_at", null),
    ),
    headCount("orders", (q) =>
      q.eq("status", "paid").gte("placed_at", iso30dAgo),
    ),
    headCount("orders", (q) => q.eq("status", "failed")),
    headCount("refunds", (q) => q.eq("status", "pending")),
    headCount("reports", (q) => q.eq("status", "open")),
    headCount("package_scans", (q) =>
      q.in("status", ["pending", "failed", "suspicious", "malicious"]),
    ),
    supabase
      .from("orders")
      .select("paid_fils, placed_at")
      .eq("status", "paid")
      .gte("placed_at", iso30dAgo)
      .order("placed_at", { ascending: false })
      .range(0, 999),
    supabase
      .from("activity_events")
      .select("id, actor_id, action, target_type, target_id, created_at")
      .order("created_at", { ascending: false })
      .range(0, 9),
  ]);

  const revenueCapped = (revenueRows.data?.length ?? 0) >= 1000;
  const revenueFils = revenueRows.error
    ? null
    : (revenueRows.data ?? []).reduce(
        (s: number, r: any) => s + (r.paid_fils ?? 0),
        0,
      );

  return {
    kpis: [
      {
        label: "Revenue (30d)",
        value: formatKWD(revenueFils),
        hint: revenueCapped
          ? "≥1,000 paid orders in period — sum truncated"
          : "Paid orders, last 30 days",
      },
      {
        label: "Paid orders (30d)",
        value: paidOrders30d?.toLocaleString() ?? "—",
        unavailable: paidOrders30d == null ? "Query failed" : undefined,
      },
      {
        label: "Active entitlements",
        value: activeEntitlements?.toLocaleString() ?? "—",
        unavailable: activeEntitlements == null ? "Query failed" : undefined,
      },
      {
        label: "Lifetime unlocks",
        value: lifetimeEntitlements?.toLocaleString() ?? "—",
        hint: "grant_reason = lifetime_purchase",
      },
      {
        label: "Total resources",
        value: totalResources?.toLocaleString() ?? "—",
        hint:
          publishedResources != null
            ? `${publishedResources.toLocaleString()} published`
            : undefined,
      },
      {
        label: "Downloads (all-time)",
        value: "Unavailable",
        unavailable: "download log not wired in Phase 1",
      },
    ] as Kpi[],
    attention: [
      { key: "drafts", label: "Draft resources", count: drafts, to: "/admin/publishing/drafts", icon: FileEdit },
      { key: "review", label: "Awaiting review", count: review, to: "/admin/publishing/review", icon: ClipboardCheck },
      { key: "scans", label: "Scans needing action", count: dirtyScans, to: "/admin/trust/scans", icon: ShieldCheck },
      { key: "orders", label: "Failed payments", count: failedOrders, to: "/admin/orders", icon: ShoppingBag },
      { key: "refunds", label: "Pending refunds", count: pendingRefunds, to: "/admin/orders/refunds", icon: RotateCcw },
      { key: "reports", label: "Open reports", count: openReports, to: "/admin/trust/reports", icon: Flag },
    ] as Attention[],
    recent: recent.data ?? [],
  };
}

export default function OverviewV2() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "v2", "overview"],
    queryFn: fetchOverview,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-dark-base sm:text-2xl">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Real counts pulled from resources, orders, entitlements, refunds,
            reports, and package scans. Values labelled “Unavailable” have not
            been wired yet — never assume 0.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="min-h-[40px]">
            <Link to="/admin/publishing/imports"><Package className="mr-1.5 h-3.5 w-3.5" />New Resource</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="min-h-[40px]">
            <Link to="/admin/publishing/imports"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Import</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="min-h-[40px]">
            <Link to="/admin/publishing/review"><ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />Review Queue</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="min-h-[40px]">
            <Link to="/admin/orders/payment-events"><Wallet className="mr-1.5 h-3.5 w-3.5" />Reconcile Payments</Link>
          </Button>
        </div>
      </header>

      {isError ? (
        <Card>
          <CardContent className="flex items-center justify-between p-4 text-sm">
            <span>Failed to load overview metrics.</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : null}

      <section aria-label="Attention required">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warm-gold" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Attention Required
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {(data?.attention ?? Array.from({ length: 6 }).map((_, i) => ({
            key: String(i), label: "", count: null, to: "/admin", icon: AlertTriangle,
          }))).map((a) => {
            const Icon = a.icon;
            const badge =
              a.count == null
                ? "—"
                : a.count > 0
                ? a.count.toLocaleString()
                : "0";
            const isAlert = (a.count ?? 0) > 0;
            return (
              <Link
                key={a.key}
                to={a.to}
                className={`group flex flex-col rounded-lg border p-3 transition-colors min-h-[88px] focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-gold ${
                  isAlert
                    ? "border-warm-gold/60 bg-warm-gold/10 hover:bg-warm-gold/15"
                    : "border-gray-200 bg-white hover:bg-muted/50"
                }`}
                aria-label={`${a.label}: ${badge}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <Icon className={`h-4 w-4 ${isAlert ? "text-warm-gold" : "text-muted-foreground"}`} aria-hidden />
                  {isLoading ? (
                    <Skeleton className="h-4 w-8" />
                  ) : (
                    <span className={`text-lg font-semibold tabular-nums ${isAlert ? "text-dark-base" : "text-muted-foreground"}`}>
                      {badge}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground group-hover:text-dark-base">
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
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Key Metrics
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {(data?.kpis ?? Array.from({ length: 6 }).map(() => null)).map((k, i) => (
            <Card key={k?.label ?? i}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  {isLoading || !k ? <Skeleton className="h-3 w-20" /> : k.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {isLoading || !k ? (
                  <Skeleton className="h-6 w-24" />
                ) : k.unavailable ? (
                  <div>
                    <span className="text-sm italic text-muted-foreground">Unavailable</span>
                    <p className="mt-1 text-[11px] text-muted-foreground">{k.unavailable}</p>
                  </div>
                ) : (
                  <div>
                    <div className="text-xl font-semibold tabular-nums text-dark-base">{k.value}</div>
                    {k.hint ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">{k.hint}</p>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-label="Recent activity">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-dark-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (data?.recent ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity events yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {(data?.recent ?? []).map((r: any) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-dark-base">{r.action}</span>
                      <span className="text-muted-foreground"> · {r.target_type ?? "—"}</span>
                    </div>
                    <time className="ml-3 shrink-0 text-xs text-muted-foreground" dateTime={r.created_at}>
                      {new Date(r.created_at).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

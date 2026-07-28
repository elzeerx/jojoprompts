// Security Events — actionable admin view.
//
// Reads public.security_logs via the admin-authorized SELECT policy.
// Never writes: browser-side INSERTs are blocked by RLS and the
// regression test `noClientSecurityLogsWrite.test.ts` guards it.
//
// Design goals for the release-blocker refactor:
//   - Default view hides routine noise (route_access, developer_tools_opened)
//     unless the admin explicitly selects "All events".
//   - Metrics are calculated from truthful, server-bounded 24-hour queries
//     (COUNT(*) HEAD requests), not from the currently loaded page.
//   - Bounded server-side pagination (PAGE_SIZE = 50).
//   - Accessible filters: severity, category, action, text search.
//   - User identifiers are masked in list rows.
//   - No hover-only actions; 44px minimum touch targets; RTL-safe.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Shield,
  AlertTriangle,
  Activity,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { createLogger } from "@/utils/logging";

import {
  SECURITY_EVENTS_PAGE_SIZE,
  ROUTINE_NOISE_ACTIONS,
  SEVERITY_OPTIONS,
  CATEGORY_OPTIONS,
  WINDOW_OPTIONS,
  WINDOW_LABELS,
  parseSecurityEventsFilters,
  twentyFourHoursAgoISO,
  windowSinceISO,
} from "./securityEventsFilters";

const logger = createLogger("SECURITY_MONITORING");

interface SecurityLogRow {
  id: string;
  action: string;
  user_id: string | null;
  ip_address: string | null;
  severity: string | null;
  event_category: string | null;
  created_at: string;
}

interface Metrics24h {
  total: number;
  unauthorized: number;
  rateLimit: number;
  suspicious: number;
  loading: boolean;
  error: string | null;
}

function maskUserId(id: string | null): string {
  if (!id) return "—";
  const head = id.slice(0, 8);
  return `user_${head}***`;
}

function severityBadgeVariant(
  severity: string,
): "destructive" | "secondary" | "outline" | "default" {
  switch (severity) {
    case "critical":
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

function actionIcon(action: string) {
  switch (action) {
    case "unauthorized_access_attempt":
    case "unauthorized_admin_access_attempt":
      return <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />;
    case "rate_limit_exceeded":
      return <Activity className="h-4 w-4 text-orange-500" aria-hidden="true" />;
    case "suspicious_activity":
    case "suspicious_admin_activity_detected":
      return <Eye className="h-4 w-4 text-yellow-500" aria-hidden="true" />;
    default:
      return <Shield className="h-4 w-4 text-blue-500" aria-hidden="true" />;
  }
}


export function SecurityMonitoringDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => parseSecurityEventsFilters(searchParams),
    [searchParams],
  );

  const [rows, setRows] = useState<SecurityLogRow[]>([]);
  const [totalMatching, setTotalMatching] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [metrics, setMetrics] = useState<Metrics24h>({
    total: 0,
    unauthorized: 0,
    rateLimit: 0,
    suspicious: 0,
    loading: true,
    error: null,
  });

  const updateFilter = (patch: Partial<Record<string, string | null>>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
    }
    // Any filter mutation resets page to 1.
    if (!("page" in patch)) next.delete("page");
    setSearchParams(next, { replace: true });
  };

  // ---------- 24h server-bounded metrics ----------
  useEffect(() => {
    let cancelled = false;
    const since = twentyFourHoursAgoISO();
    (async () => {
      setMetrics((m) => ({ ...m, loading: true, error: null }));
      try {
        const noiseFilter = filters.includeNoise
          ? undefined
          : (ROUTINE_NOISE_ACTIONS as readonly string[]);

        const baseCount = supabase
          .from("security_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", since);
        const totalQ = noiseFilter
          ? baseCount.not(
              "action",
              "in",
              `(${noiseFilter.map((a) => `"${a}"`).join(",")})`,
            )
          : baseCount;

        const unauthorizedQ = supabase
          .from("security_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", since)
          .in("action", [
            "unauthorized_access_attempt",
            "unauthorized_admin_access_attempt",
            "admin_function_access_denied",
          ]);
        const rateLimitQ = supabase
          .from("security_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", since)
          .eq("action", "rate_limit_exceeded");
        const suspiciousQ = supabase
          .from("security_logs")
          .select("*", { count: "exact", head: true })
          .gte("created_at", since)
          .in("action", [
            "suspicious_activity",
            "suspicious_admin_activity_detected",
            "session_hijacking_detected",
          ]);

        const [total, unauth, rate, susp] = await Promise.all([
          totalQ,
          unauthorizedQ,
          rateLimitQ,
          suspiciousQ,
        ]);
        if (cancelled) return;
        if (total.error || unauth.error || rate.error || susp.error) {
          throw total.error ?? unauth.error ?? rate.error ?? susp.error;
        }
        setMetrics({
          total: total.count ?? 0,
          unauthorized: unauth.count ?? 0,
          rateLimit: rate.count ?? 0,
          suspicious: susp.count ?? 0,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        logger.error("Failed to load 24h security metrics", err);
        setMetrics((m) => ({
          ...m,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load metrics",
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters.includeNoise, refreshTick]);

  // ---------- Paginated events list ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setListLoading(true);
      setListError(null);
      try {
        const from = (filters.page - 1) * SECURITY_EVENTS_PAGE_SIZE;
        const to = from + SECURITY_EVENTS_PAGE_SIZE - 1;
        let query = supabase
          .from("security_logs")
          .select("id, action, user_id, ip_address, details, created_at", {
            count: "exact",
          })
          .order("created_at", { ascending: false })
          .range(from, to);

        if (!filters.includeNoise) {
          query = query.not(
            "action",
            "in",
            `(${ROUTINE_NOISE_ACTIONS.map((a) => `"${a}"`).join(",")})`,
          );
        }
        if (filters.action && filters.action !== "all") {
          query = query.eq("action", filters.action);
        }
        if (filters.severity !== "all") {
          // Severity lives inside JSON details.
          query = query.eq("details->>severity", filters.severity);
        }
        if (filters.category !== "all") {
          query = query.eq("details->>event_category", filters.category);
        }
        if (filters.q.trim()) {
          // ilike against the action slug — safe, indexable string column.
          query = query.ilike("action", `%${filters.q.trim()}%`);
        }

        const { data, count, error } = await query;
        if (cancelled) return;
        if (error) throw error;
        setRows((data ?? []) as SecurityLogRow[]);
        setTotalMatching(count ?? 0);
      } catch (err) {
        if (cancelled) return;
        logger.error("Failed to load security events page", err);
        setListError(err instanceof Error ? err.message : "Failed to load events");
        setRows([]);
        setTotalMatching(0);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    filters.page,
    filters.severity,
    filters.category,
    filters.action,
    filters.q,
    filters.includeNoise,
    refreshTick,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(totalMatching / SECURITY_EVENTS_PAGE_SIZE),
  );
  const canPrev = filters.page > 1;
  const canNext = filters.page < totalPages;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-dark-base">Security Events</h1>
          <p className="text-muted-foreground">
            Actionable security signals from the last 24 hours. Routine route
            access and developer-tools noise are hidden by default.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setRefreshTick((t) => t + 1)}
          variant="outline"
          className="gap-2 min-h-[44px]"
          aria-label="Refresh security events"
        >
          <RefreshCw
            className={`h-4 w-4 ${listLoading || metrics.loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>

      {/* Metrics — always 24h, server-bounded */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total events (last 24h)"
          value={metrics.total}
          loading={metrics.loading}
          icon={<Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
          hint={
            filters.includeNoise
              ? "Includes routine noise"
              : "Excludes route access / dev-tools noise"
          }
        />
        <MetricCard
          label="Unauthorized attempts (24h)"
          value={metrics.unauthorized}
          loading={metrics.loading}
          icon={<AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />}
          valueClass="text-red-600"
        />
        <MetricCard
          label="Rate-limit violations (24h)"
          value={metrics.rateLimit}
          loading={metrics.loading}
          icon={<Activity className="h-4 w-4 text-orange-500" aria-hidden="true" />}
          valueClass="text-orange-600"
        />
        <MetricCard
          label="Suspicious activity (24h)"
          value={metrics.suspicious}
          loading={metrics.loading}
          icon={<Eye className="h-4 w-4 text-yellow-500" aria-hidden="true" />}
          valueClass="text-yellow-600"
        />
      </div>

      {metrics.error && (
        <Alert variant="destructive" role="alert">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            Could not load 24-hour metrics: {metrics.error}.{" "}
            <button
              type="button"
              onClick={() => setRefreshTick((t) => t + 1)}
              className="underline underline-offset-2"
            >
              Retry
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label htmlFor="sev" className="mb-1 block text-xs font-medium">
                Severity
              </label>
              <Select
                value={filters.severity}
                onValueChange={(v) => updateFilter({ severity: v })}
              >
                <SelectTrigger id="sev" className="min-h-[44px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "all" ? "All severities" : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="cat" className="mb-1 block text-xs font-medium">
                Category
              </label>
              <Select
                value={filters.category}
                onValueChange={(v) => updateFilter({ category: v })}
              >
                <SelectTrigger id="cat" className="min-h-[44px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c === "all" ? "All categories" : c.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="act" className="mb-1 block text-xs font-medium">
                Action
              </label>
              <Input
                id="act"
                value={filters.action === "all" ? "" : filters.action}
                onChange={(e) =>
                  updateFilter({ action: e.target.value.trim() || null })
                }
                placeholder="e.g. rate_limit_exceeded"
                className="min-h-[44px]"
              />
            </div>
            <div>
              <label htmlFor="q" className="mb-1 block text-xs font-medium">
                Search action
              </label>
              <Input
                id="q"
                value={filters.q}
                onChange={(e) => updateFilter({ q: e.target.value || null })}
                placeholder="Contains…"
                className="min-h-[44px]"
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={filters.includeNoise}
                  onChange={(e) =>
                    updateFilter({ noise: e.target.checked ? "1" : null })
                  }
                />
                <span className="text-sm">Include all events (route + dev tools)</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Events{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({totalMatching.toLocaleString()} matching · page {filters.page} of{" "}
              {totalPages})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listError ? (
            <Alert variant="destructive" role="alert">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Could not load events: {listError}.{" "}
                <button
                  type="button"
                  onClick={() => setRefreshTick((t) => t + 1)}
                  className="underline underline-offset-2"
                >
                  Retry
                </button>
              </AlertDescription>
            </Alert>
          ) : listLoading ? (
            <div
              className="flex items-center justify-center py-16"
              role="status"
              aria-live="polite"
            >
              <RefreshCw className="h-6 w-6 animate-spin text-warm-gold" aria-hidden="true" />
              <span className="sr-only">Loading security events…</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No matching security events in this window.
            </div>
          ) : (
            <ul className="space-y-2" aria-label="Security events">
              {rows.map((log) => {
                const severity = severityFromDetails(log.details);
                return (
                  <li
                    key={log.id}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="flex-shrink-0 mt-0.5">{actionIcon(log.action)}</div>
                    <div className="flex-grow min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-sm break-all">
                          {log.action.replace(/_/g, " ")}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant={severityBadgeVariant(severity)}>{severity}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), "MMM dd, HH:mm:ss")}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        User: {maskUserId(log.user_id)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Pagination */}
          <nav
            className="mt-4 flex items-center justify-between gap-2"
            aria-label="Events pagination"
          >
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] gap-2"
              disabled={!canPrev || listLoading}
              onClick={() =>
                updateFilter({ page: String(Math.max(1, filters.page - 1)) })
              }
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <div className="text-xs text-muted-foreground">
              Page {filters.page} of {totalPages}
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] gap-2"
              disabled={!canNext || listLoading}
              onClick={() =>
                updateFilter({ page: String(Math.min(totalPages, filters.page + 1)) })
              }
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard(props: {
  label: string;
  value: number;
  loading: boolean;
  icon: React.ReactNode;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{props.label}</CardTitle>
        {props.icon}
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${props.valueClass ?? ""}`}
          aria-live="polite"
        >
          {props.loading ? "…" : props.value.toLocaleString()}
        </div>
        {props.hint && (
          <div className="mt-1 text-xs text-muted-foreground">{props.hint}</div>
        )}
      </CardContent>
    </Card>
  );
}

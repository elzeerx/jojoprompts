import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Apple,
  CheckCircle,
  Clock,
  Mail,
  RefreshCw,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/utils/logging";
import { EmailMonitoringAlerts } from "@/components/admin/EmailMonitoringAlerts";
import {
  computeDeliveryMetrics,
  computeDomainStats,
  DeliveryLog,
  periodToHours,
  type DeliveryMetrics,
  type DomainStat,
  type Period,
} from "./deliveryHealthUtils";

const logger = createLogger("DELIVERY_HEALTH");

const EMPTY_METRICS: DeliveryMetrics = {
  attempted: 0,
  delivered: 0,
  failed: 0,
  pending: 0,
  bounced: 0,
  retried: 0,
  successRate: 0,
  bounceRate: 0,
  retryRate: 0,
};

/**
 * V2 Delivery Health — single canonical operations surface for outbound email.
 *
 * Consolidates the legacy "Email Management" + "Email Analytics" shells into
 * one heading, one toolbar, compact metrics, delivery attempts, domain
 * breakdown, and a subordinate monitoring alerts section. Renders visible
 * loading / empty / error / retry states and is mobile-safe (>=44px targets,
 * responsive stacking, table has intentional horizontal scroll).
 */
export default function DeliveryHealthPage() {
  const { isAdmin } = useAuth();

  const [period, setPeriod] = useState<Period>("24h");
  const [emailType, setEmailType] = useState<string>("all");
  const [metrics, setMetrics] = useState<DeliveryMetrics>(EMPTY_METRICS);
  const [domainStats, setDomainStats] = useState<DomainStat[]>([]);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cutoff = new Date(
        Date.now() - periodToHours(period) * 60 * 60 * 1000,
      ).toISOString();

      let query = supabase
        .from("email_logs")
        .select(
          "id,email_address,email_type,domain_type,delivery_status,bounce_reason,retry_count,attempted_at,success",
        )
        .gte("attempted_at", cutoff)
        .order("attempted_at", { ascending: false })
        .limit(1000);
      if (emailType !== "all") {
        query = query.eq("email_type", emailType);
      }

      const { data, error: qErr } = await query;
      if (qErr) throw qErr;

      const rows = (data ?? []) as DeliveryLog[];
      setLogs(rows.slice(0, 20));
      setMetrics(computeDeliveryMetrics(rows));
      setDomainStats(computeDomainStats(rows));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load";
      logger.error("delivery health load failed", err);
      setError(message);
      setLogs([]);
      setMetrics(EMPTY_METRICS);
      setDomainStats([]);
    } finally {
      setLoading(false);
    }
  }, [period, emailType]);

  // Hooks must run unconditionally; the admin gate is enforced in render.
  useEffect(() => {
    if (!isAdmin) return;
    load();
  }, [isAdmin, load]);

  const pct = useCallback(
    (v: number) => `${v.toFixed(1)}%`,
    [],
  );

  const isEmpty = useMemo(
    () => !loading && !error && metrics.attempted === 0,
    [loading, error, metrics.attempted],
  );

  if (!isAdmin) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Administrative privileges required to view delivery health.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-dark-base sm:text-2xl">
            Delivery Health
          </h1>
          <p className="text-sm text-muted-foreground">
            Outbound email attempts, delivery outcomes, and domain performance.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger
              aria-label="Period"
              className="w-full min-h-[44px] md:w-[160px]"
            >
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last hour</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={emailType} onValueChange={setEmailType}>
            <SelectTrigger
              aria-label="Message type"
              className="w-full min-h-[44px] md:w-[180px]"
            >
              <SelectValue placeholder="Message type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="confirmation">Confirmation</SelectItem>
              <SelectItem value="password-reset">Password reset</SelectItem>
              <SelectItem value="welcome">Welcome</SelectItem>
              <SelectItem value="v2_order_receipt">V2 order receipt</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => load()}
            disabled={loading}
            className="min-h-[44px]"
            aria-label="Refresh delivery health"
          >
            <RefreshCw
              className={`me-1 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span className="break-words">{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => load()}
              className="min-h-[44px]"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Compact metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric
          icon={<Mail className="h-4 w-4 text-muted-foreground" />}
          label="Attempted"
          value={metrics.attempted.toLocaleString()}
          loading={loading}
        />
        <Metric
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          label="Success rate"
          value={pct(metrics.successRate)}
          sub={`${metrics.delivered.toLocaleString()} delivered`}
          loading={loading}
        />
        <Metric
          icon={<XCircle className="h-4 w-4 text-rose-600" />}
          label="Failed"
          value={metrics.failed.toLocaleString()}
          loading={loading}
        />
        <Metric
          icon={<Clock className="h-4 w-4 text-amber-600" />}
          label="Pending"
          value={metrics.pending.toLocaleString()}
          loading={loading}
        />
        <Metric
          icon={<XCircle className="h-4 w-4 text-rose-600" />}
          label="Bounce rate"
          value={pct(metrics.bounceRate)}
          loading={loading}
        />
        <Metric
          icon={<RefreshCw className="h-4 w-4 text-muted-foreground" />}
          label="Retries"
          value={metrics.retried.toLocaleString()}
          sub={pct(metrics.retryRate)}
          loading={loading}
        />
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Mail className="h-6 w-6" aria-hidden />
            <div>No delivery attempts in the selected window.</div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Domain breakdown */}
          {domainStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Domain performance</CardTitle>
                <CardDescription>
                  Delivery outcomes grouped by recipient domain type.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead className="text-right">Attempted</TableHead>
                        <TableHead className="text-right">Delivered</TableHead>
                        <TableHead className="text-right">Failed</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {domainStats.map((s) => (
                        <TableRow key={s.domain_type}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {s.domain_type === "apple" && (
                                <Apple className="h-4 w-4" aria-hidden />
                              )}
                              <span className="capitalize break-words">
                                {s.domain_type}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {s.total}
                          </TableCell>
                          <TableCell className="text-right text-emerald-700 tabular-nums">
                            {s.successful}
                          </TableCell>
                          <TableCell className="text-right text-rose-700 tabular-nums">
                            {s.failed}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                s.success_rate >= 80
                                  ? "default"
                                  : s.success_rate >= 60
                                    ? "secondary"
                                    : "destructive"
                              }
                            >
                              {s.success_rate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent attempts */}
          <Card>
            <CardHeader>
              <CardTitle>Recent delivery attempts</CardTitle>
              <CardDescription>
                Last {logs.length} attempts in the selected window.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead className="text-right">Retries</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <StatusBadge log={l} />
                        </TableCell>
                        <TableCell className="max-w-[220px] break-words text-sm">
                          {l.email_address}
                        </TableCell>
                        <TableCell className="text-sm">
                          {l.email_type}
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {l.domain_type}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {l.retry_count || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(l.attempted_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Subordinate monitoring alerts — same page, not a competing shell */}
      <section aria-label="Monitoring alerts" className="space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className="h-4 w-4 text-warm-gold"
            aria-hidden
          />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Monitoring alerts
          </h2>
        </div>
        <EmailMonitoringAlerts />
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <Card className="h-[92px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
        <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="truncate text-lg font-semibold tabular-nums text-dark-base">
          {loading ? "…" : value}
        </div>
        {sub && (
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ log }: { log: DeliveryLog }) {
  if (log.success) {
    return (
      <Badge className="bg-emerald-100 text-emerald-800">
        <CheckCircle className="me-1 h-3 w-3" aria-hidden />
        Delivered
      </Badge>
    );
  }
  if (log.delivery_status === "pending") {
    return (
      <Badge variant="secondary">
        <Clock className="me-1 h-3 w-3" aria-hidden />
        Pending
      </Badge>
    );
  }
  return (
    <Badge variant="destructive">
      <XCircle className="me-1 h-3 w-3" aria-hidden />
      Failed
    </Badge>
  );
}

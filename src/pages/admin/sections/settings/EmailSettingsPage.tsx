import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/v2/admin/format";
import {
  useAdminEmailSettingsStatus,
  useAdminEmailSettingsSummary,
} from "@/hooks/admin/v2/useAdminEmailSettings";
import {
  boundaryRows,
  formatPercent,
  readinessRows,
  successRate,
  type StatusTone,
} from "@/lib/v2/admin/emailSettings";
import { EMAIL_NAV_LINKS } from "@/lib/v2/admin/emailSettingsRoutes";

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
      <div className="text-lg font-semibold tabular-nums break-words">{value}</div>
    </div>
  );
}

export default function EmailSettingsPage() {
  const statusQ = useAdminEmailSettingsStatus();
  const summaryQ = useAdminEmailSettingsSummary();

  const config = useMemo(
    () => (statusQ.data ? readinessRows(statusQ.data) : []),
    [statusQ.data],
  );
  const boundaries = useMemo(
    () => (statusQ.data ? boundaryRows(statusQ.data) : []),
    [statusQ.data],
  );

  const rate = successRate(summaryQ.data?.delivery ?? null);

  const refreshing = statusQ.isFetching || summaryQ.isFetching;
  const refreshAll = () => {
    void statusQ.refetch();
    void summaryQ.refetch();
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Mail className="h-6 w-6" aria-hidden />
            Email settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only overview of the transactional email stack. Template
            editing and detailed delivery analytics live under Communications.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={refreshAll}
          disabled={refreshing}
          className="min-h-[44px] w-full sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2 min-w-0">
            {statusQ.data?.configured ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
            )}
            Configuration
          </CardTitle>
          <Badge variant="outline" className="text-xs shrink-0">Server-reported</Badge>
        </CardHeader>
        <CardContent>
          {statusQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : statusQ.isError || !statusQ.data ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Unable to load configuration</AlertTitle>
              <AlertDescription>
                The admin email status service did not respond. Retry using the
                Refresh button above.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {config.map((r) => (
                  <div
                    key={r.key}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3 gap-2"
                  >
                    <div className="text-sm">{r.label}</div>
                    <Badge
                      className={`border ${toneClass(r.tone)} whitespace-normal break-all text-left`}
                      variant="outline"
                    >
                      {r.value}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-muted-foreground break-words">
                Services: {statusQ.data.services.join(", ")}
              </div>
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>Secret handling</AlertTitle>
                <AlertDescription>
                  The Resend API key is managed in Supabase Function Secrets
                  and is never displayed here.
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Verification boundaries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification boundaries</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertTitle>What this page reports</AlertTitle>
            <AlertDescription>
              This page reports whether the Resend API key secret is present
              and shows the fixed application email configuration. It does not
              validate the key, verify sending, or probe function/provider
              health. Resend uptime, DNS/DKIM/SPF, and Supabase Auth SMTP are
              not checked here. Transactional email uses Resend via Edge
              Functions; authentication emails are managed separately by
              Supabase Auth.
            </AlertDescription>
          </Alert>
          {statusQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {boundaries.map((r) => (
                <div
                  key={r.key}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3 gap-2"
                >
                  <div className="text-sm">{r.label}</div>
                  <Badge
                    className={`border ${toneClass(r.tone)} whitespace-normal break-words text-left`}
                    variant="outline"
                  >
                    {r.value}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last 24h delivery snapshot */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base min-w-0">
            Delivery snapshot
          </CardTitle>
          <Badge variant="outline" className="text-xs shrink-0">Last 24 hours</Badge>
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
              <AlertTitle>Unable to load snapshot</AlertTitle>
              <AlertDescription>
                The email summary service did not respond. Retry using the
                Refresh button above.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <Metric label="Attempts" value={summaryQ.data.delivery.attempts} />
                <Metric label="Sent" value={summaryQ.data.delivery.sent} />
                <Metric label="Failed" value={summaryQ.data.delivery.failed} />
                <Metric label="Blocked" value={summaryQ.data.delivery.blocked} />
                <Metric label="Success rate" value={formatPercent(rate)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Metric
                  label="Last logged event"
                  value={
                    summaryQ.data.delivery.last_event_at
                      ? formatDateTime(summaryQ.data.delivery.last_event_at)
                      : "—"
                  }
                />
                <Metric
                  label="Templates"
                  value={`${summaryQ.data.templates.active} active · ${summaryQ.data.templates.inactive} inactive`}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                As of {formatDateTime(summaryQ.data.as_of)} · aggregate only, no
                message-level data shown here
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Communications</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EMAIL_NAV_LINKS.map((n) => (
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

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/utils/logging";

const logger = createLogger("DELIVERY_HEALTH_ALERTS");

type AlertLevel = "warning" | "critical";

interface AlertRow {
  id: string;
  level: AlertLevel;
  action: string;
  domain?: string | null;
  rate?: number | null;
  volume?: number | null;
  message?: string | null;
  created_at: string;
}

/**
 * V2 Delivery Health — READ-ONLY subordinate monitoring alerts panel.
 *
 * Sources rows from security_logs where action IN
 * (email_delivery_warning, email_delivery_critical_failure). No local rule
 * config, no toggles, no synthetic test inserts, no marketing copy. All
 * hooks execute before any conditional return.
 */
export function MonitoringAlertsPanel() {
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("security_logs")
        .select("id, action, details, created_at")
        .in("action", [
          "email_delivery_warning",
          "email_delivery_critical_failure",
        ])
        .order("created_at", { ascending: false })
        .limit(20);
      if (qErr) throw qErr;
      const mapped: AlertRow[] = (data ?? []).map((r: any) => {
        const details = (r.details ?? {}) as Record<string, unknown>;
        const level: AlertLevel =
          r.action === "email_delivery_critical_failure"
            ? "critical"
            : "warning";
        const rateRaw = details.rate ?? details.failure_rate ?? null;
        const volumeRaw = details.volume ?? details.count ?? null;
        return {
          id: r.id,
          action: r.action,
          level,
          domain: (details.domain as string) ?? null,
          rate: typeof rateRaw === "number" ? rateRaw : null,
          volume: typeof volumeRaw === "number" ? volumeRaw : null,
          message: (details.message as string) ?? null,
          created_at: r.created_at,
        };
      });
      setRows(mapped);
    } catch (err) {
      logger.error("Failed to load monitoring alerts", err);
      let msg = "Failed to load alerts";
      if (err instanceof Error && err.message) {
        msg = err.message;
      } else if (err && typeof err === "object") {
        const anyErr = err as { message?: unknown; error?: unknown };
        if (typeof anyErr.message === "string" && anyErr.message.length > 0) {
          msg = anyErr.message;
        } else if (typeof anyErr.error === "string" && anyErr.error.length > 0) {
          msg = anyErr.error;
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Recent email delivery warnings and critical failures from the
          security event log.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          className="min-h-[44px] min-w-[44px] touch-manipulation"
          aria-label="Refresh monitoring alerts"
        >
          <RefreshCw
            className={`me-1 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden
          />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span className="break-words">{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              className="min-h-[44px] min-w-[44px] touch-manipulation"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading && !error && (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Loading monitoring alerts…
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No monitoring alerts in the recent event log.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <ul className="divide-y rounded-md border">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      row.level === "critical" ? "destructive" : "secondary"
                    }
                    className="uppercase tracking-wide"
                  >
                    <AlertTriangle className="me-1 h-3 w-3" aria-hidden />
                    {row.level}
                  </Badge>
                  {row.domain && (
                    <span className="break-all text-xs font-medium text-dark-base">
                      {row.domain}
                    </span>
                  )}
                </div>
                {row.message && (
                  <p className="break-words text-sm text-muted-foreground">
                    {row.message}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                  {row.rate != null && (
                    <span>rate {(row.rate * 100).toFixed(1)}%</span>
                  )}
                  {row.volume != null && <span>volume {row.volume}</span>}
                  <span className="font-mono">{row.action}</span>
                </div>
              </div>
              <time
                className="shrink-0 text-xs text-muted-foreground"
                dateTime={row.created_at}
              >
                {new Date(row.created_at).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

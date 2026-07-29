import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gauge, Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  formatP75,
  readoutState,
  targetLabel,
  type AdminWebVitalsData,
  type CoreWebVitalName,
  type WebVitalDeviceClass,
  type WebVitalEnvironment,
} from "@/lib/v2/admin/webVitals";

const METRICS: CoreWebVitalName[] = ["LCP", "INP", "CLS"];
const DEVICES: WebVitalDeviceClass[] = ["mobile", "desktop"];
const PERIOD_DAYS = 7;

async function fetchWebVitals(
  environment: WebVitalEnvironment,
): Promise<AdminWebVitalsData> {
  const { data, error } = await supabase.rpc("get_admin_v2_web_vitals", {
    p_period_days: PERIOD_DAYS,
    p_environment: environment,
  });
  if (error) throw error;
  return data as unknown as AdminWebVitalsData;
}

const stateLabels = {
  collecting: "Collecting data",
  good: "Good",
  "needs-attention": "Needs attention",
} as const;

const stateClasses = {
  collecting: "bg-muted text-muted-foreground",
  good: "bg-emerald-50 text-emerald-700",
  "needs-attention": "bg-amber-50 text-amber-800",
} as const;

export function WebVitalsPanel() {
  const [environment, setEnvironment] =
    useState<WebVitalEnvironment>("production");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "v2", "web-vitals", PERIOD_DAYS, environment],
    queryFn: () => fetchWebVitals(environment),
    staleTime: 60_000,
  });
  const minimumSamples = data?.minimum_samples ?? 75;

  return (
    <section aria-label="Core Web Vitals">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Core Web Vitals · p75 · last {PERIOD_DAYS} days
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Anonymous field measurements. A result is graded only after{" "}
            {minimumSamples} samples for that metric and device.
          </p>
        </div>
        <div
          className="flex rounded-lg border bg-white p-1"
          aria-label="Performance environment"
        >
          {(["production", "preview"] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={environment === option ? "secondary" : "ghost"}
              className="min-h-[44px] capitalize"
              aria-pressed={environment === option}
              onClick={() => setEnvironment(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>

      {isError ? (
        <Card className="mb-3">
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
            <span>Performance measurements are temporarily unavailable.</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {DEVICES.map((device) => {
          const DeviceIcon = device === "mobile" ? Smartphone : Monitor;
          return (
            <div key={device}>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium capitalize text-dark-base">
                <DeviceIcon className="h-4 w-4" aria-hidden />
                {device}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {METRICS.map((metric) => {
                  const row = data?.metrics.find(
                    (item) =>
                      item.device_class === device &&
                      item.metric_name === metric,
                  );
                  const state = readoutState(
                    metric,
                    row,
                    minimumSamples,
                  );
                  return (
                    <Card key={`${device}-${metric}`} className="min-h-[132px]">
                      <CardHeader className="flex-row items-start justify-between gap-2 p-3 pb-1">
                        <span className="text-sm font-semibold text-dark-base">
                          {metric}
                        </span>
                        {isLoading ? (
                          <Skeleton className="h-5 w-20" />
                        ) : (
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-medium ${stateClasses[state]}`}
                          >
                            {stateLabels[state]}
                          </span>
                        )}
                      </CardHeader>
                      <CardContent className="p-3 pt-1">
                        {isLoading ? (
                          <Skeleton className="mt-2 h-7 w-24" />
                        ) : (
                          <>
                            <div className="text-xl font-semibold tabular-nums text-dark-base">
                              {formatP75(metric, row?.p75)}
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {targetLabel(metric)}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {(row?.sample_count ?? 0).toLocaleString()} samples
                              {row ? ` · ${row.good_rate}% good` : ""}
                            </p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

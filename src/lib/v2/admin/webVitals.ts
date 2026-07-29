export type CoreWebVitalName = "LCP" | "INP" | "CLS";
export type WebVitalDeviceClass = "mobile" | "desktop";
export type WebVitalEnvironment = "production" | "preview";

export interface AdminWebVitalMetric {
  metric_name: CoreWebVitalName;
  device_class: WebVitalDeviceClass;
  sample_count: number;
  p75: number;
  good_rate: number;
  latest_at: string;
  sufficient_samples: boolean;
}

export interface AdminWebVitalsData {
  period_days: number;
  period_since: string;
  environment: WebVitalEnvironment;
  minimum_samples: number;
  metrics: AdminWebVitalMetric[];
}

export type WebVitalReadoutState =
  | "collecting"
  | "good"
  | "needs-attention";

const GOOD_THRESHOLDS: Record<CoreWebVitalName, number> = {
  LCP: 2_500,
  INP: 200,
  CLS: 0.1,
};

export function targetLabel(metric: CoreWebVitalName): string {
  if (metric === "CLS") return "Target ≤ 0.100";
  return `Target ≤ ${GOOD_THRESHOLDS[metric].toLocaleString()} ms`;
}

export function formatP75(
  metric: CoreWebVitalName,
  value: number | null | undefined,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (metric === "CLS") return value.toFixed(3);
  return `${Math.round(value).toLocaleString()} ms`;
}

export function readoutState(
  metric: CoreWebVitalName,
  row: AdminWebVitalMetric | undefined,
  minimumSamples: number,
): WebVitalReadoutState {
  if (!row || row.sample_count < minimumSamples || !row.sufficient_samples) {
    return "collecting";
  }
  return row.p75 <= GOOD_THRESHOLDS[metric] ? "good" : "needs-attention";
}

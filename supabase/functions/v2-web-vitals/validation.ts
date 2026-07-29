export const CORE_WEB_VITAL_NAMES = ["LCP", "INP", "CLS"] as const;
export type CoreWebVitalName = (typeof CORE_WEB_VITAL_NAMES)[number];
export type WebVitalEnvironment = "production" | "preview" | "development";
export type WebVitalDeviceClass = "mobile" | "desktop";
export type WebVitalRating = "good" | "needs-improvement" | "poor";

const NAVIGATION_TYPES = new Set([
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
  "soft-navigation",
]);
const METRIC_NAMES = new Set<string>(CORE_WEB_VITAL_NAMES);
const METRIC_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const CONTROL_CHARACTER_RE = /[\u0000-\u001f\u007f]/;
const BODY_KEYS = new Set(["route", "viewport_width", "metrics"]);
const METRIC_KEYS = new Set(["name", "value", "id", "navigation_type"]);

export interface WebVitalMetricInput {
  name: CoreWebVitalName;
  value: number;
  id: string;
  navigation_type: string;
}

export interface WebVitalBatchInput {
  route: string;
  viewport_width: number;
  metrics: WebVitalMetricInput[];
}

export interface WebVitalSample {
  metric_name: CoreWebVitalName;
  value: number;
  rating: WebVitalRating;
  route_path: string;
  device_class: WebVitalDeviceClass;
  environment: WebVitalEnvironment;
  navigation_type: string;
  metric_id: string;
}

export type ValidationResult =
  | { ok: true; value: WebVitalBatchInput }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isValidRoute(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 160 &&
    value.startsWith("/") &&
    !value.includes("?") &&
    !value.includes("#") &&
    !CONTROL_CHARACTER_RE.test(value)
  );
}

function isValidMetricValue(name: string, value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (name === "CLS") return value >= 0 && value <= 10;
  return value >= 0 && value <= 120_000;
}

export function validateWebVitalBatch(input: unknown): ValidationResult {
  if (!isRecord(input) || !hasOnlyKeys(input, BODY_KEYS)) {
    return { ok: false, error: "invalid_payload" };
  }
  if (!isValidRoute(input.route)) {
    return { ok: false, error: "invalid_route" };
  }
  if (
    typeof input.viewport_width !== "number" ||
    !Number.isInteger(input.viewport_width) ||
    input.viewport_width < 1 ||
    input.viewport_width > 10_000
  ) {
    return { ok: false, error: "invalid_viewport" };
  }
  if (
    !Array.isArray(input.metrics) ||
    input.metrics.length < 1 ||
    input.metrics.length > 3
  ) {
    return { ok: false, error: "invalid_metrics" };
  }

  const names = new Set<string>();
  const metrics: WebVitalMetricInput[] = [];
  for (const candidate of input.metrics) {
    if (!isRecord(candidate) || !hasOnlyKeys(candidate, METRIC_KEYS)) {
      return { ok: false, error: "invalid_metric" };
    }
    if (
      typeof candidate.name !== "string" ||
      !METRIC_NAMES.has(candidate.name) ||
      names.has(candidate.name)
    ) {
      return { ok: false, error: "invalid_metric_name" };
    }
    if (!isValidMetricValue(candidate.name, candidate.value)) {
      return { ok: false, error: "invalid_metric_value" };
    }
    if (
      typeof candidate.id !== "string" ||
      !METRIC_ID_RE.test(candidate.id)
    ) {
      return { ok: false, error: "invalid_metric_id" };
    }
    if (
      typeof candidate.navigation_type !== "string" ||
      !NAVIGATION_TYPES.has(candidate.navigation_type)
    ) {
      return { ok: false, error: "invalid_navigation_type" };
    }

    names.add(candidate.name);
    metrics.push({
      name: candidate.name as CoreWebVitalName,
      value: candidate.value as number,
      id: candidate.id,
      navigation_type: candidate.navigation_type,
    });
  }

  return {
    ok: true,
    value: {
      route: input.route,
      viewport_width: input.viewport_width,
      metrics,
    },
  };
}

export function environmentForOrigin(
  origin: string | null,
): WebVitalEnvironment | null {
  if (
    origin === "https://jojoprompts.com" ||
    origin === "https://www.jojoprompts.com" ||
    origin === "https://jojoprompts.lovable.app"
  ) {
    return "production";
  }
  if (
    origin ===
    "https://id-preview--766f3370-d38c-42e5-8566-5e4946986dd2.lovable.app"
  ) {
    return "preview";
  }
  if (origin === "http://localhost:8080" || origin === "http://localhost:5173") {
    return "development";
  }
  return null;
}

export function ratingForMetric(
  name: CoreWebVitalName,
  value: number,
): WebVitalRating {
  const [good, needsImprovement] =
    name === "LCP" ? [2_500, 4_000] :
    name === "INP" ? [200, 500] :
    [0.1, 0.25];
  if (value <= good) return "good";
  if (value <= needsImprovement) return "needs-improvement";
  return "poor";
}

export function toSamples(
  batch: WebVitalBatchInput,
  environment: WebVitalEnvironment,
): WebVitalSample[] {
  const deviceClass: WebVitalDeviceClass =
    batch.viewport_width < 768 ? "mobile" : "desktop";
  return batch.metrics.map((metric) => ({
    metric_name: metric.name,
    value: metric.value,
    rating: ratingForMetric(metric.name, metric.value),
    route_path: batch.route,
    device_class: deviceClass,
    environment,
    navigation_type: metric.navigation_type,
    metric_id: metric.id,
  }));
}

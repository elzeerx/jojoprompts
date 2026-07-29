import { isLaunchLocked } from "@/config/siteMode";

const WEB_VITALS_ENDPOINT =
  "https://fxkqgjakbyrxkmevkglv.supabase.co/functions/v1/v2-web-vitals";

type CoreWebVitalName = "LCP" | "INP" | "CLS";
type NavigationType =
  | "navigate"
  | "reload"
  | "back-forward"
  | "back-forward-cache"
  | "prerender"
  | "restore"
  | "soft-navigation";

interface ReportableMetric {
  name: string;
  value: number;
  id: string;
  navigationType: string;
}

export function sanitizeVitalRoute(pathname: string): string {
  const pathnameOnly = pathname.split(/[?#]/, 1)[0] ?? "/";
  const withoutControls = Array.from(pathnameOnly)
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    })
    .join("");
  const rooted = withoutControls.startsWith("/") ? withoutControls : "/";
  return rooted.slice(0, 160) || "/";
}

export function buildWebVitalPayload(
  metric: ReportableMetric,
  route: string,
  viewportWidth: number,
) {
  return {
    route: sanitizeVitalRoute(route),
    viewport_width: Math.min(
      10_000,
      Math.max(1, Math.round(viewportWidth || 1)),
    ),
    metrics: [{
      name: metric.name as CoreWebVitalName,
      value: metric.value,
      id: metric.id,
      navigation_type: metric.navigationType as NavigationType,
    }],
  };
}

function reportMetric(
  metric: ReportableMetric,
  route: string,
  viewportWidth: number,
): void {
  if (!["LCP", "INP", "CLS"].includes(metric.name)) return;
  const payload = buildWebVitalPayload(metric, route, viewportWidth);
  void fetch(WEB_VITALS_ENDPOINT, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Performance telemetry is best-effort and must never interrupt the app.
  });
}

export function startWebVitalsMonitoring(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (isLaunchLocked()) return;
  if (navigator.doNotTrack === "1") return;

  const initialRoute = sanitizeVitalRoute(window.location.pathname);
  const initialViewportWidth = window.innerWidth;
  const register = async () => {
    try {
      const { onCLS, onINP, onLCP } = await import("web-vitals");
      const callback = (metric: ReportableMetric) =>
        reportMetric(metric, initialRoute, initialViewportWidth);
      onCLS(callback);
      onINP(callback);
      onLCP(callback);
    } catch {
      // Monitoring cannot become a product availability dependency.
    }
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => void register(), { timeout: 3_000 });
  } else {
    window.setTimeout(() => void register(), 1_500);
  }
}

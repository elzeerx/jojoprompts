// Pure helpers for the Security Events admin dashboard, extracted
// so unit tests do not need to import React or the Supabase client
// (which touches window.localStorage at module load).

export const SECURITY_EVENTS_PAGE_SIZE = 50;

/** Actions considered routine noise; hidden by default. */
export const ROUTINE_NOISE_ACTIONS = [
  "route_access",
  "developer_tools_opened",
] as const;

export const SEVERITY_OPTIONS = [
  "all",
  "critical",
  "high",
  "medium",
  "low",
  "info",
] as const;

export const CATEGORY_OPTIONS = [
  "all",
  "authentication",
  "authorization",
  "data_access",
  "session_management",
  "api_security",
  "database_security",
  "security_incident",
  "access_control",
  "system",
  "general",
] as const;

/** Time window for the events LIST query. Metrics are always 24h. */
export const WINDOW_OPTIONS = ["24h", "7d", "30d", "all"] as const;
export type SecurityEventsWindow = (typeof WINDOW_OPTIONS)[number];

export interface SecurityEventsFilters {
  page: number;
  severity: (typeof SEVERITY_OPTIONS)[number];
  category: (typeof CATEGORY_OPTIONS)[number];
  action: string; // "all" or a specific slug
  q: string;
  includeNoise: boolean;
  window: SecurityEventsWindow;
}

export function parseSecurityEventsFilters(
  params: URLSearchParams,
): SecurityEventsFilters {
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const severity = params.get("severity") as SecurityEventsFilters["severity"] | null;
  const category = params.get("category") as SecurityEventsFilters["category"] | null;
  const windowRaw = params.get("window") as SecurityEventsWindow | null;
  return {
    page,
    severity:
      severity && (SEVERITY_OPTIONS as readonly string[]).includes(severity)
        ? severity
        : "all",
    category:
      category && (CATEGORY_OPTIONS as readonly string[]).includes(category)
        ? category
        : "all",
    action: (params.get("action") ?? "all").slice(0, 128),
    q: (params.get("q") ?? "").slice(0, 128),
    includeNoise: params.get("noise") === "1",
    window:
      windowRaw && (WINDOW_OPTIONS as readonly string[]).includes(windowRaw)
        ? windowRaw
        : "24h",
  };
}

/** ISO timestamp exactly 24h before `now` — bounds every metric query. */
export function twentyFourHoursAgoISO(now: Date = new Date()): string {
  return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Lower `created_at` bound (ISO) for the list query for a given window.
 * `all` returns null → no lower bound applied. 24h is the default.
 */
export function windowSinceISO(
  window: SecurityEventsWindow,
  now: Date = new Date(),
): string | null {
  const day = 24 * 60 * 60 * 1000;
  switch (window) {
    case "24h":
      return new Date(now.getTime() - day).toISOString();
    case "7d":
      return new Date(now.getTime() - 7 * day).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * day).toISOString();
    case "all":
    default:
      return null;
  }
}

export const WINDOW_LABELS: Record<SecurityEventsWindow, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All history",
};

/** Filter/window keys that must reset pagination to page 1 when they change. */
export const FILTER_KEYS_RESETTING_PAGE = [
  "severity",
  "category",
  "action",
  "q",
  "noise",
  "window",
] as const;

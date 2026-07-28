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

export interface SecurityEventsFilters {
  page: number;
  severity: (typeof SEVERITY_OPTIONS)[number];
  category: (typeof CATEGORY_OPTIONS)[number];
  action: string; // "all" or a specific slug
  q: string;
  includeNoise: boolean;
}

export function parseSecurityEventsFilters(
  params: URLSearchParams,
): SecurityEventsFilters {
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const severity = params.get("severity") as SecurityEventsFilters["severity"] | null;
  const category = params.get("category") as SecurityEventsFilters["category"] | null;
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
  };
}

/** ISO timestamp exactly 24h before `now` — bounds every metric query. */
export function twentyFourHoursAgoISO(now: Date = new Date()): string {
  return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
}

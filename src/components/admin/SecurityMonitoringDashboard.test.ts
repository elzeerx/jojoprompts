import { describe, it, expect } from "bun:test";
import {
  parseSecurityEventsFilters,
  twentyFourHoursAgoISO,
  windowSinceISO,
  WINDOW_OPTIONS,
  ROUTINE_NOISE_ACTIONS,
  SECURITY_EVENTS_PAGE_SIZE,
  FILTER_KEYS_RESETTING_PAGE,
  CATEGORY_OPTIONS,
  CATEGORY_LABELS,
  IMPOSSIBLE_CATEGORY_SLUGS,
} from "@/components/admin/securityEventsFilters";


declare const require: (m: string) => any;
const { readFileSync } = require("fs");
const { resolve } = require("path");

describe("SecurityMonitoringDashboard — filter mapping & bounds", () => {
  it("defaults exclude routine noise, start at page 1, and use the 24h window", () => {
    const f = parseSecurityEventsFilters(new URLSearchParams());
    expect(f.page).toBe(1);
    expect(f.severity).toBe("all");
    expect(f.category).toBe("all");
    expect(f.action).toBe("all");
    expect(f.q).toBe("");
    expect(f.includeNoise).toBe(false);
    expect(f.window).toBe("24h");
  });

  it("routine-noise actions are the exact set the query must hide by default", () => {
    expect([...ROUTINE_NOISE_ACTIONS].sort()).toEqual(
      ["developer_tools_opened", "route_access"].sort(),
    );
  });

  it("clamps invalid page numbers to 1 and floors positive floats", () => {
    expect(parseSecurityEventsFilters(new URLSearchParams("page=0")).page).toBe(1);
    expect(parseSecurityEventsFilters(new URLSearchParams("page=-5")).page).toBe(1);
    expect(parseSecurityEventsFilters(new URLSearchParams("page=abc")).page).toBe(1);
    expect(parseSecurityEventsFilters(new URLSearchParams("page=3.9")).page).toBe(3);
    expect(parseSecurityEventsFilters(new URLSearchParams("page=42")).page).toBe(42);
  });

  it("rejects unknown severity/category/window values, falling back to defaults", () => {
    const p = new URLSearchParams("severity=nuclear&category=made_up&window=forever");
    const f = parseSecurityEventsFilters(p);
    expect(f.severity).toBe("all");
    expect(f.category).toBe("all");
    expect(f.window).toBe("24h");
  });

  it("accepts documented severity/category values verbatim (top-level columns)", () => {
    const p = new URLSearchParams("severity=high&category=authorization");
    const f = parseSecurityEventsFilters(p);
    expect(f.severity).toBe("high");
    expect(f.category).toBe("authorization");
  });

  it("noise=1 opts the admin into all-events mode", () => {
    expect(parseSecurityEventsFilters(new URLSearchParams("noise=1")).includeNoise).toBe(true);
    expect(parseSecurityEventsFilters(new URLSearchParams("noise=0")).includeNoise).toBe(false);
    expect(parseSecurityEventsFilters(new URLSearchParams()).includeNoise).toBe(false);
  });

  it("truncates hostile action/q inputs to 128 chars", () => {
    const long = "x".repeat(500);
    const f = parseSecurityEventsFilters(
      new URLSearchParams(`action=${long}&q=${long}`),
    );
    expect(f.action.length).toBe(128);
    expect(f.q.length).toBe(128);
  });

  it("24h metric ISO is exactly 24h before the injected 'now'", () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    expect(twentyFourHoursAgoISO(now)).toBe("2026-07-27T12:00:00.000Z");
  });

  it("bounded page size stays at 50 (no unbounded fetches)", () => {
    expect(SECURITY_EVENTS_PAGE_SIZE).toBe(50);
  });

  it("supports 24h/7d/30d/all list windows with correct created_at lower bound", () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    expect(windowSinceISO("24h", now)).toBe("2026-07-27T12:00:00.000Z");
    expect(windowSinceISO("7d", now)).toBe("2026-07-21T12:00:00.000Z");
    expect(windowSinceISO("30d", now)).toBe("2026-06-28T12:00:00.000Z");
    expect(windowSinceISO("all", now)).toBeNull();
  });

  it("each documented window is selectable via ?window=", () => {
    for (const w of WINDOW_OPTIONS) {
      const f = parseSecurityEventsFilters(new URLSearchParams(`window=${w}`));
      expect(f.window).toBe(w);
    }
  });

  it("changing severity/category/action/q/noise/window must reset pagination to page 1", () => {
    // Contract: the dashboard reset rule is expressed as the set of keys
    // that, when mutated, drop the page param. Every filter key is listed;
    // `page` itself is intentionally not.
    expect([...FILTER_KEYS_RESETTING_PAGE].sort()).toEqual(
      ["action", "category", "noise", "q", "severity", "window"].sort(),
    );
  });
});

describe("SecurityMonitoringDashboard — source regression", () => {
  const src = readFileSync(
    resolve("src/components/admin/SecurityMonitoringDashboard.tsx"),
    "utf8",
  ) as string;

  it("must not filter or read severity/category from JSON details", () => {
    expect(src.includes("details->>severity")).toBe(false);
    expect(src.includes("details->>event_category")).toBe(false);
    expect(src.includes("severityFromDetails")).toBe(false);
  });

  it("must query the top-level severity and event_category columns", () => {
    expect(src).toContain('.eq("severity"');
    expect(src).toContain('.eq("event_category"');
    expect(src).toContain("severity, event_category");
  });

  it("must apply the selected list window via a created_at gte bound", () => {
    expect(src).toContain("windowSinceISO(filters.window)");
    expect(src).toContain('.gte("created_at"');
  });

  it("resets pagination when any filter changes (page param dropped)", () => {
    // updateFilter drops `page` whenever the mutated key is not "page".
    expect(src).toContain('if (!("page" in patch)) next.delete("page")');
  });
});

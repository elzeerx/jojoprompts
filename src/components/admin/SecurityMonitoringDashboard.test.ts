import { describe, it, expect } from "bun:test";
import {
  parseSecurityEventsFilters,
  twentyFourHoursAgoISO,
  ROUTINE_NOISE_ACTIONS,
  SECURITY_EVENTS_PAGE_SIZE,
} from "@/components/admin/securityEventsFilters";

describe("SecurityMonitoringDashboard — filter mapping & bounds", () => {
  it("defaults exclude routine noise and start at page 1", () => {
    const f = parseSecurityEventsFilters(new URLSearchParams());
    expect(f.page).toBe(1);
    expect(f.severity).toBe("all");
    expect(f.category).toBe("all");
    expect(f.action).toBe("all");
    expect(f.q).toBe("");
    expect(f.includeNoise).toBe(false);
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

  it("rejects unknown severity/category values, falling back to 'all'", () => {
    const p = new URLSearchParams("severity=nuclear&category=made_up");
    const f = parseSecurityEventsFilters(p);
    expect(f.severity).toBe("all");
    expect(f.category).toBe("all");
  });

  it("accepts documented severity/category values verbatim", () => {
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

  it("24h window ISO is exactly 24h before the injected 'now'", () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    expect(twentyFourHoursAgoISO(now)).toBe("2026-07-27T12:00:00.000Z");
  });

  it("bounded page size stays at 50 (no unbounded fetches)", () => {
    expect(SECURITY_EVENTS_PAGE_SIZE).toBe(50);
  });
});

import { describe, expect, it } from "bun:test";
import {
  buildWebVitalPayload,
  sanitizeVitalRoute,
} from "@/lib/v2/webVitals";

describe("privacy-safe web vitals payload", () => {
  it("keeps pathname only and strips control characters", () => {
    expect(sanitizeVitalRoute("/explore?email=user@example.com#result")).toBe(
      "/explore",
    );
    expect(sanitizeVitalRoute("/skills\u0000private")).toBe("/skillsprivate");
    expect(sanitizeVitalRoute("not-rooted")).toBe("/");
  });

  it("contains no account, query, browser, or DOM attribution data", () => {
    const payload = buildWebVitalPayload(
      {
        name: "LCP",
        value: 2450,
        id: "v6-123-abc",
        navigationType: "navigate",
      },
      "/explore?token=secret",
      390,
    );
    expect(payload).toEqual({
      route: "/explore",
      viewport_width: 390,
      metrics: [{
        name: "LCP",
        value: 2450,
        id: "v6-123-abc",
        navigation_type: "navigate",
      }],
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /user|email|token|cookie|agent|selector|element/i,
    );
  });

  it("bounds the viewport width and route length", () => {
    const payload = buildWebVitalPayload(
      {
        name: "CLS",
        value: 0.02,
        id: "v6-123-def",
        navigationType: "reload",
      },
      `/${"a".repeat(300)}`,
      50_000,
    );
    expect(payload.route.length).toBe(160);
    expect(payload.viewport_width).toBe(10_000);
  });
});

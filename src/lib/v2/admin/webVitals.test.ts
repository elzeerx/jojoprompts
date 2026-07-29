import { describe, expect, it } from "bun:test";
import {
  formatP75,
  readoutState,
  targetLabel,
  type AdminWebVitalMetric,
} from "@/lib/v2/admin/webVitals";

function row(overrides: Partial<AdminWebVitalMetric> = {}): AdminWebVitalMetric {
  return {
    metric_name: "LCP",
    device_class: "mobile",
    sample_count: 75,
    p75: 2500,
    good_rate: 80,
    latest_at: "2026-07-29T17:00:00Z",
    sufficient_samples: true,
    ...overrides,
  };
}

describe("admin Core Web Vitals readout", () => {
  it("does not claim a pass below the minimum sample size", () => {
    expect(
      readoutState("LCP", row({ sample_count: 74, p75: 1000 }), 75),
    ).toBe("collecting");
    expect(readoutState("INP", undefined, 75)).toBe("collecting");
  });

  it("uses canonical p75 good thresholds", () => {
    expect(readoutState("LCP", row({ p75: 2500 }), 75)).toBe("good");
    expect(readoutState("LCP", row({ p75: 2501 }), 75)).toBe(
      "needs-attention",
    );
    expect(
      readoutState(
        "CLS",
        row({ metric_name: "CLS", p75: 0.1 }),
        75,
      ),
    ).toBe("good");
    expect(
      readoutState(
        "INP",
        row({ metric_name: "INP", p75: 201 }),
        75,
      ),
    ).toBe("needs-attention");
  });

  it("formats timing and layout metrics in their correct units", () => {
    expect(formatP75("LCP", 2450.4)).toBe("2,450 ms");
    expect(formatP75("INP", 199.6)).toBe("200 ms");
    expect(formatP75("CLS", 0.0274)).toBe("0.027");
    expect(targetLabel("CLS")).toBe("Target ≤ 0.100");
  });
});

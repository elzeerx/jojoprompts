/**
 * Delivery Health helper + source contract tests.
 */
import { describe, it, expect } from "bun:test";
import {
  computeDeliveryMetrics,
  computeDomainStats,
  periodToHours,
  type DeliveryLog,
} from "./deliveryHealthUtils";

declare const require: (m: string) => any;

function read(rel: string): string {
  const fs = require("fs") as { readFileSync(p: string, enc: string): string };
  return fs.readFileSync(rel, "utf8");
}

function log(partial: Partial<DeliveryLog>): DeliveryLog {
  return {
    id: partial.id ?? "id-" + Math.random().toString(36).slice(2),
    email_address: partial.email_address ?? "user@example.com",
    email_type: partial.email_type ?? "welcome",
    domain_type: partial.domain_type ?? "other",
    delivery_status: partial.delivery_status ?? "sent",
    bounce_reason: partial.bounce_reason ?? null,
    retry_count: partial.retry_count ?? 0,
    attempted_at: partial.attempted_at ?? new Date().toISOString(),
    success: partial.success ?? true,
  };
}

function near(actual: number, expected: number, epsilon = 0.01): boolean {
  return Math.abs(actual - expected) <= epsilon;
}

describe("deliveryHealthUtils.periodToHours", () => {
  it("maps supported windows", () => {
    expect(periodToHours("1h")).toBe(1);
    expect(periodToHours("24h")).toBe(24);
    expect(periodToHours("7d")).toBe(168);
    expect(periodToHours("30d")).toBe(720);
  });
});

describe("deliveryHealthUtils.computeDeliveryMetrics", () => {
  it("returns zeros for empty logs", () => {
    const m = computeDeliveryMetrics([]);
    expect(m.attempted).toBe(0);
    expect(m.successRate).toBe(0);
    expect(m.bounceRate).toBe(0);
    expect(m.retryRate).toBe(0);
  });

  it("puts delivered/failed/pending in mutually exclusive buckets", () => {
    const m = computeDeliveryMetrics([
      log({ success: true, delivery_status: "sent" }),
      log({ success: true, delivery_status: "sent" }),
      log({ success: false, delivery_status: "failed" }),
      log({ success: false, delivery_status: "pending" }),
    ]);
    expect(m.attempted).toBe(4);
    expect(m.delivered).toBe(2);
    expect(m.failed).toBe(1);
    expect(m.pending).toBe(1);
    expect(m.delivered + m.failed + m.pending).toBe(m.attempted);
    expect(near(m.successRate, 50)).toBe(true);
  });

  it("counts bounces and retries independently", () => {
    const m = computeDeliveryMetrics([
      log({ success: false, delivery_status: "failed", bounce_reason: "hard" }),
      log({ success: true, retry_count: 2 }),
    ]);
    expect(m.bounced).toBe(1);
    expect(m.retried).toBe(1);
    expect(near(m.bounceRate, 50)).toBe(true);
    expect(near(m.retryRate, 50)).toBe(true);
  });
});

describe("deliveryHealthUtils.computeDomainStats", () => {
  it("groups by domain type and sorts by volume desc", () => {
    const stats = computeDomainStats([
      log({ domain_type: "apple", success: true }),
      log({ domain_type: "apple", success: false, delivery_status: "failed" }),
      log({ domain_type: "google", success: true }),
      log({ domain_type: "google", success: true }),
      log({ domain_type: "google", success: true }),
    ]);
    expect(stats[0].domain_type).toBe("google");
    expect(stats[0].total).toBe(3);
    expect(near(stats[0].success_rate, 100)).toBe(true);
    expect(stats[1].domain_type).toBe("apple");
    expect(near(stats[1].success_rate, 50)).toBe(true);
  });
});

describe("DeliveryHealthPage source contract", () => {
  const raw = read("src/pages/admin/sections/communications/DeliveryHealthPage.tsx");
  const source = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("renders a single Delivery Health H1", () => {
    const h1Matches = source.match(/<h1[^>]*>[\s\S]*?<\/h1>/g) ?? [];
    expect(h1Matches.length).toBe(1);
    expect(h1Matches[0].includes("Delivery Health")).toBe(true);
    expect(!/Email Management/.test(source)).toBe(true);
    expect(!/Email Analytics<\//.test(source)).toBe(true);
  });

  it("uses the V2 read-only MonitoringAlertsPanel, not the legacy shell", () => {
    expect(source.includes("<MonitoringAlertsPanel />")).toBe(true);
    expect(source.includes("<EmailMonitoringAlerts")).toBe(false);
    expect(source.includes("EmailMonitoringAlerts")).toBe(false);
    const h1Idx = source.indexOf("Delivery Health");
    const panelIdx = source.indexOf("<MonitoringAlertsPanel />");
    expect(panelIdx > h1Idx).toBe(true);
    // Section renders exactly one Monitoring alerts H2.
    const h2Matches = source.match(/<h2[^>]*>[\s\S]*?<\/h2>/g) ?? [];
    const monitoringH2s = h2Matches.filter((h) =>
      /Monitoring alerts/i.test(h),
    );
    expect(monitoringH2s.length).toBe(1);
  });

  it("MonitoringAlertsPanel is read-only and free of legacy friction", () => {
    const panelRaw = read(
      "src/pages/admin/sections/communications/MonitoringAlertsPanel.tsx",
    );
    const panel = panelRaw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // No synthetic test-alert flow.
    expect(/Test Alert/i.test(panel)).toBe(false);
    // No local fake rule config.
    expect(/DEFAULT_ALERT_RULES/.test(panel)).toBe(false);
    // No <Switch/> UI or toggleAlertRule state-changing controls.
    expect(/<Switch[\s>]/.test(panel)).toBe(false);
    expect(/toggleAlertRule|setAlertRules/.test(panel)).toBe(false);
    // No writes into security_logs from the panel.
    expect(/\.from\(\s*['"]security_logs['"]\s*\)[\s\S]*\.insert\(/.test(panel)).toBe(
      false,
    );
    expect(/\.insert\(\s*\{[\s\S]*action:\s*['"]email_delivery/.test(panel)).toBe(
      false,
    );
    // Reads the right event sources.
    expect(panel.includes("email_delivery_warning")).toBe(true);
    expect(panel.includes("email_delivery_critical_failure")).toBe(true);
    // Honest states + 44px targets.
    expect(/Loading/i.test(panel)).toBe(true);
    expect(/No monitoring alerts/i.test(panel)).toBe(true);
    expect(/Retry/.test(panel)).toBe(true);
    expect(/min-h-\[44px\]/.test(panel)).toBe(true);
    // All hooks before any conditional return.
    const returnIdx = panel.search(/^\s*return\s*\(/m);
    for (const hook of ["useState", "useEffect", "useCallback"]) {
      const firstHookIdx = panel.indexOf(`${hook}(`);
      expect(firstHookIdx > 0).toBe(true);
      expect(firstHookIdx < returnIdx).toBe(true);
    }
  });

  it("has loading/empty/error/retry and mobile-safe controls", () => {
    expect(/setLoading\(true\)/.test(source)).toBe(true);
    expect(/setError\(/.test(source)).toBe(true);
    expect(/Retry|Refresh/.test(source)).toBe(true);
    expect(/No delivery|No results|empty/i.test(source)).toBe(true);
    expect(/min-h-\[44px\]/.test(source)).toBe(true);
    expect(/overflow-x-auto/.test(source)).toBe(true);
  });

  it("does not violate Rules of Hooks (all hooks before admin guard)", () => {
    const guardIdx = source.indexOf("if (!isAdmin)");
    expect(guardIdx > 0).toBe(true);
    for (const hook of ["useState", "useEffect"]) {
      const firstHookIdx = source.indexOf(`${hook}(`);
      expect(firstHookIdx > 0).toBe(true);
      expect(firstHookIdx < guardIdx).toBe(true);
    }
  });
});

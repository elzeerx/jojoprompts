import { describe, expect, it } from "bun:test";
import {
  boundaryRows,
  formatPercent,
  normalizeEmailSettingsStatus,
  normalizeEmailSettingsSummary,
  readinessRows,
  stripStatusFields,
  successRate,
  type EmailSettingsStatus,
} from "./emailSettings";
import { EMAIL_NAV_LINKS } from "./emailSettingsRoutes";

const baseStatus: EmailSettingsStatus = {
  provider: "resend",
  transport: "edge_functions",
  configured: true,
  provider_api_key_configured: true,
  sender_name: "JoJo Prompts",
  sender_address: "info@jojoprompts.com",
  reply_to: "info@jojoprompts.com",
  domain: "jojoprompts.com",
  provider_health_check: "not_checked",
  domain_verification: "not_checked",
  auth_email_transport: "separate_not_checked",
  primary_service: "send-email",
  services: ["send-email"],
};

describe("emailSettings.readinessRows", () => {
  it("marks configured/ok when api key present", () => {
    const rows = readinessRows(baseStatus);
    const configured = rows.find((r) => r.key === "configured")!;
    const api = rows.find((r) => r.key === "api_key")!;
    expect(configured.tone).toBe("ok");
    expect(api.tone).toBe("ok");
    expect(api.value).toBe("Present");
  });

  it("marks danger when api key missing", () => {
    const rows = readinessRows({
      ...baseStatus,
      configured: false,
      provider_api_key_configured: false,
    });
    expect(rows.find((r) => r.key === "api_key")!.tone).toBe("danger");
    expect(rows.find((r) => r.key === "configured")!.tone).toBe("warn");
  });

  it("shows sender identity as name <address>", () => {
    const rows = readinessRows(baseStatus);
    expect(rows.find((r) => r.key === "sender")!.value)
      .toBe("JoJo Prompts <info@jojoprompts.com>");
  });
});

describe("emailSettings.boundaryRows", () => {
  it("always labels boundaries as not checked here", () => {
    const rows = boundaryRows(baseStatus);
    expect(rows.map((r) => r.value)).toEqual([
      "Not checked here",
      "Not checked here",
      "Managed separately by Supabase Auth",
    ]);
    expect(rows.find((r) => r.key === "domain_verification")!.label)
      .toContain("jojoprompts.com");
  });
});

describe("emailSettings.successRate", () => {
  it("returns null when attempts is zero", () => {
    expect(successRate({ attempts: 0, sent: 0 })).toBeNull();
  });
  it("returns null on missing/invalid input", () => {
    expect(successRate(null)).toBeNull();
    expect(successRate({ attempts: Number.NaN, sent: 1 })).toBeNull();
  });
  it("clamps sent > attempts to 100%", () => {
    expect(successRate({ attempts: 10, sent: 20 })).toBe(1);
  });
  it("computes fraction", () => {
    expect(successRate({ attempts: 4, sent: 3 })).toBe(0.75);
  });
});

describe("emailSettings.formatPercent", () => {
  it("renders one decimal or em dash", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(0.5)).toBe("50.0%");
    expect(formatPercent(1)).toBe("100.0%");
  });
});

describe("emailSettings.stripStatusFields", () => {
  it("drops secret-like and unknown keys", () => {
    const raw = {
      ...baseStatus,
      // forbidden
      api_key: "x",
      resend_api_key: "y",
      token: "z",
      service_role_key: "w",
      raw_env: { any: 1 },
      // unknown
      internal_debug: true,
    };
    const out = stripStatusFields(raw);
    expect(out.api_key).toBeUndefined();
    expect(out.resend_api_key).toBeUndefined();
    expect(out.token).toBeUndefined();
    expect(out.service_role_key).toBeUndefined();
    expect(out.raw_env).toBeUndefined();
    expect((out as Record<string, unknown>).internal_debug).toBeUndefined();
    expect(out.provider).toBe("resend");
    expect(out.provider_api_key_configured).toBe(true);
  });
  it("returns {} on non-object input", () => {
    expect(stripStatusFields(null)).toEqual({});
    expect(stripStatusFields("nope")).toEqual({});
  });
});

describe("emailSettingsRoutes.EMAIL_NAV_LINKS", () => {
  it("uses canonical /admin/communications routes only", () => {
    const targets = EMAIL_NAV_LINKS.map((l) => l.to);
    expect(targets).toEqual([
      "/admin/communications/templates",
      "/admin/communications/delivery",
    ]);
    for (const t of targets) {
      expect(t.startsWith("/admin/communications/")).toBe(true);
    }
  });
});

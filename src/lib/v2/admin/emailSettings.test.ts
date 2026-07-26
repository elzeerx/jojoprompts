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

describe("normalizeEmailSettingsStatus", () => {
  const good = {
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
  it("accepts a valid payload", () => {
    expect(normalizeEmailSettingsStatus(good)?.services).toEqual(["send-email"]);
  });
  it("rejects missing fields", () => {
    const { configured: _c, ...rest } = good;
    expect(normalizeEmailSettingsStatus(rest)).toBeNull();
  });
  it("rejects wrong types", () => {
    expect(normalizeEmailSettingsStatus({ ...good, configured: "true" })).toBeNull();
    expect(normalizeEmailSettingsStatus({ ...good, services: "send-email" })).toBeNull();
  });
  it("rejects fabricated services", () => {
    expect(normalizeEmailSettingsStatus({
      ...good, services: ["send-email", "send-welcome-email"],
    })).toBeNull();
    expect(normalizeEmailSettingsStatus({ ...good, services: [] })).toBeNull();
  });
  it("rejects arrays with malformed extra entries without silently dropping them", () => {
    // Strict: raw array must be exactly ["send-email"]. Any extra, non-string,
    // empty, whitespace-padded, or nullish entry rejects the whole payload.
    expect(normalizeEmailSettingsStatus({ ...good, services: ["send-email", 123] })).toBeNull();
    expect(normalizeEmailSettingsStatus({ ...good, services: [null, "send-email"] })).toBeNull();
    expect(normalizeEmailSettingsStatus({ ...good, services: [" send-email ", ""] })).toBeNull();
    expect(normalizeEmailSettingsStatus({ ...good, services: [" send-email "] })).toBeNull();
    expect(normalizeEmailSettingsStatus({ ...good, services: ["send-email", ""] })).toBeNull();
    // Accepts exactly the canonical single-entry array.
    expect(normalizeEmailSettingsStatus({ ...good, services: ["send-email"] })?.services).toEqual(["send-email"]);
  });
  it("rejects spoofed sender identity", () => {
    expect(normalizeEmailSettingsStatus({
      ...good, sender_address: "attacker@example.com",
    })).toBeNull();
  });
  it("ignores secret-like extras and never surfaces them", () => {
    const withSecret = { ...good, api_key: "sk_live_abc", secret: "z" };
    const normalized = normalizeEmailSettingsStatus(withSecret)!;
    expect((normalized as Record<string, unknown>).api_key).toBeUndefined();
    expect((normalized as Record<string, unknown>).secret).toBeUndefined();
  });
  it("rejects null and non-objects", () => {
    expect(normalizeEmailSettingsStatus(null)).toBeNull();
    expect(normalizeEmailSettingsStatus("nope")).toBeNull();
  });
});

describe("normalizeEmailSettingsSummary", () => {
  const good = {
    provider: "resend",
    window: "24h",
    as_of: "2026-07-26T10:00:00Z",
    delivery: { attempts: 10, sent: 6, failed: 2, blocked: 1, last_event_at: "2026-07-26T09:00:00Z" },
    templates: { active: 5, inactive: 2 },
  };
  it("accepts disjoint buckets within attempts", () => {
    expect(normalizeEmailSettingsSummary(good)?.delivery.sent).toBe(6);
  });
  it("rejects when sum exceeds attempts", () => {
    expect(normalizeEmailSettingsSummary({
      ...good, delivery: { ...good.delivery, sent: 8, failed: 3, blocked: 1 },
    })).toBeNull();
  });
  it("rejects negative or non-integer counts", () => {
    expect(normalizeEmailSettingsSummary({
      ...good, delivery: { ...good.delivery, sent: -1 },
    })).toBeNull();
    expect(normalizeEmailSettingsSummary({
      ...good, delivery: { ...good.delivery, sent: 1.5 },
    })).toBeNull();
  });
  it("accepts null last_event_at", () => {
    expect(normalizeEmailSettingsSummary({
      ...good, delivery: { ...good.delivery, last_event_at: null },
    })?.delivery.last_event_at).toBeNull();
  });
  it("rejects unparseable timestamps", () => {
    expect(normalizeEmailSettingsSummary({ ...good, as_of: "not-a-date" })).toBeNull();
    expect(normalizeEmailSettingsSummary({
      ...good, delivery: { ...good.delivery, last_event_at: "nope" },
    })).toBeNull();
  });
  it("rejects wrong literals", () => {
    expect(normalizeEmailSettingsSummary({ ...good, provider: "sendgrid" })).toBeNull();
    expect(normalizeEmailSettingsSummary({ ...good, window: "7d" })).toBeNull();
  });
  it("rejects null/non-objects and missing sections", () => {
    expect(normalizeEmailSettingsSummary(null)).toBeNull();
    const { delivery: _d, ...noDelivery } = good;
    expect(normalizeEmailSettingsSummary(noDelivery)).toBeNull();
  });
});

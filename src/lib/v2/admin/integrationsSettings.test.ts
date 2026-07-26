import { describe, expect, it } from "bun:test";
import {
  INTEGRATION_ORDER,
  MCP_ENDPOINT,
  integrationStatus,
  normalizeIntegrationsSettingsStatus,
  summarize,
} from "./integrationsSettings";

function makePayload(overrides?: {
  upConfigured?: boolean;
  upEnv?: "sandbox" | "production" | "not_configured";
  upEnabled?: boolean;
  resendConfigured?: boolean;
  cmsApi?: boolean;
  cmsWorker?: boolean;
  lovable?: boolean;
}) {
  const o = {
    upConfigured: true, upEnv: "sandbox" as const, upEnabled: true,
    resendConfigured: true, cmsApi: true, cmsWorker: true, lovable: true,
    ...overrides,
  };
  return {
    as_of: "2026-07-26T00:00:00.000Z",
    integrations: [
      {
        id: "upayments", purpose: "payments",
        enabled: o.upEnabled, configured: o.upConfigured,
        environment: o.upEnv, specialist_route: "/admin/settings/payments",
      },
      {
        id: "resend", purpose: "transactional_email",
        configured: o.resendConfigured,
        sender_address: "info@jojoprompts.com",
        domain: "jojoprompts.com",
        specialist_route: "/admin/settings/email",
      },
      {
        id: "cloudmersive", purpose: "package_scanning",
        configured: o.cmsApi && o.cmsWorker,
        api_key_configured: o.cmsApi,
        worker_secret_configured: o.cmsWorker,
        specialist_route: "/admin/trust/scans",
      },
      {
        id: "lovable_ai", purpose: "ai_studio",
        configured: o.lovable,
        application_services: ["ai-studio-chat", "ai-studio-image"],
        specialist_route: "/admin/publishing/new",
      },
      {
        id: "jojoprompts_mcp", purpose: "mcp_access",
        configuration_state: "application_contract",
        auth: "supabase_oauth", service: "mcp",
        contract_version: "0.1.0",
        tools: ["list_my_prompts"],
        endpoint: MCP_ENDPOINT,
        deployment_status: "not_checked",
      },
    ],
    boundaries: {
      provider_health: "not_checked",
      deployment_status: "not_checked",
      secret_values: "never_exposed",
    },
  };
}

describe("normalizeIntegrationsSettingsStatus", () => {
  it("accepts a fully configured payload", () => {
    const r = normalizeIntegrationsSettingsStatus(makePayload());
    expect(r === null).toBe(false);
    expect(r!.integrations.map((i) => i.id)).toEqual([...INTEGRATION_ORDER]);
  });

  it("accepts partial cloudmersive as not configured", () => {
    const r = normalizeIntegrationsSettingsStatus(
      makePayload({ cmsApi: true, cmsWorker: false }),
    );
    expect(r === null).toBe(false);
    const cms = r!.integrations[2];
    expect(cms.configured).toBe(false);
    expect(cms.api_key_configured).toBe(true);
    expect(cms.worker_secret_configured).toBe(false);
  });

  it("accepts an all-unconfigured payload", () => {
    const r = normalizeIntegrationsSettingsStatus(
      makePayload({
        upConfigured: false, upEnabled: false, upEnv: "not_configured",
        resendConfigured: false, cmsApi: false, cmsWorker: false, lovable: false,
      }),
    );
    expect(r === null).toBe(false);
    const s = summarize(r!);
    expect(s).toEqual({
      total: 5, configured: 0, needs_configuration: 4, contract_only: 1,
    });
  });

  it("rejects missing integration", () => {
    const p = makePayload();
    p.integrations.splice(2, 1);
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects extra integration", () => {
    const p = makePayload();
    p.integrations.push({ ...p.integrations[0] });
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects wrong order", () => {
    const p = makePayload();
    [p.integrations[0], p.integrations[1]] = [p.integrations[1], p.integrations[0]];
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects duplicate id", () => {
    const p = makePayload();
    (p.integrations[1] as any).id = "upayments";
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects secret-like top-level key", () => {
    const p: any = { ...makePayload(), api_key: "leak" };
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects nested secret-like key", () => {
    const p: any = makePayload();
    (p.integrations[1] as any).resend_secret = "sk_live_x";
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects wrong MCP endpoint", () => {
    const p = makePayload();
    (p.integrations[4] as any).endpoint = "https://evil.example.com/mcp";
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects wrong MCP tool", () => {
    const p = makePayload();
    (p.integrations[4] as any).tools = ["list_my_prompts", "extra"];
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects wrong contract version", () => {
    const p = makePayload();
    (p.integrations[4] as any).contract_version = "0.2.0";
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects wrong specialist route", () => {
    const p = makePayload();
    (p.integrations[0] as any).specialist_route = "/admin/foo";
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects cloudmersive configured inconsistent with sub-booleans", () => {
    const p = makePayload();
    (p.integrations[2] as any).configured = true;
    (p.integrations[2] as any).worker_secret_configured = false;
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects malformed as_of", () => {
    const p: any = makePayload();
    p.as_of = "not-a-date";
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects malformed boundaries", () => {
    const p: any = makePayload();
    p.boundaries.provider_health = "ok";
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects unknown top-level key", () => {
    const p: any = { ...makePayload(), extra: 1 };
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });



  it("rejects non-canonical but parseable as_of like 'July 26, 2026'", () => {
    const p: any = makePayload();
    p.as_of = "July 26, 2026";
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects ISO with timezone offset (non-canonical)", () => {
    const p: any = makePayload();
    p.as_of = "2026-07-26T00:00:00+00:00";
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("accepts canonical Date.toISOString() as_of", () => {
    const p: any = makePayload();
    p.as_of = new Date("2026-07-26T12:34:56.789Z").toISOString();
    expect(normalizeIntegrationsSettingsStatus(p) === null).toBe(false);
  });

  it("rejects upayments configured=true when enabled=false", () => {
    const p = makePayload();
    (p.integrations[0] as any).enabled = false;
    (p.integrations[0] as any).configured = true;
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects upayments configured=true when environment=not_configured", () => {
    const p = makePayload({ upEnv: "not_configured" });
    (p.integrations[0] as any).configured = true;
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects upayments enabled=false with configured=true", () => {
    const p = makePayload({ upEnabled: false, upConfigured: true, upEnv: "sandbox" });
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("rejects upayments environment=not_configured with configured=true", () => {
    const p = makePayload({ upEnv: "not_configured", upConfigured: true, upEnabled: true });
    expect(normalizeIntegrationsSettingsStatus(p)).toBeNull();
  });

  it("accepts valid partial upayments: enabled=true sandbox configured=false", () => {
    const p = makePayload({ upEnabled: true, upEnv: "sandbox", upConfigured: false });
    const r = normalizeIntegrationsSettingsStatus(p);
    expect(r === null).toBe(false);
    expect(r!.integrations[0].configured).toBe(false);
    expect((r!.integrations[0] as any).enabled).toBe(true);
  });
});

describe("integrationStatus", () => {
  it("marks MCP as Application contract", () => {
    const r = normalizeIntegrationsSettingsStatus(makePayload())!;
    expect(integrationStatus(r.integrations[4]).label).toBe("Application contract");
  });

  it("marks configured as Configured, unconfigured as Needs configuration", () => {
    const r = normalizeIntegrationsSettingsStatus(
      makePayload({ resendConfigured: false }),
    )!;
    expect(integrationStatus(r.integrations[1]).label).toBe("Needs configuration");
    expect(integrationStatus(r.integrations[0]).label).toBe("Configured");
  });
});

describe("summarize", () => {
  it("counts correctly for mixed state", () => {
    const r = normalizeIntegrationsSettingsStatus(
      makePayload({ resendConfigured: false, cmsWorker: false }),
    )!;
    expect(summarize(r)).toEqual({
      total: 5, configured: 2, needs_configuration: 2, contract_only: 1,
    });
  });
});

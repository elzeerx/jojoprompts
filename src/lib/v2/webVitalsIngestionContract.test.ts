import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  environmentForOrigin,
  ratingForMetric,
  toSamples,
  validateWebVitalBatch,
} from "../../../supabase/functions/v2-web-vitals/validation";

const migration = readFileSync(
  "supabase/migrations/20260729171438_v2_web_vitals_rum.sql",
  "utf8",
);
const executableMigration = migration.replace(/^--.*$/gm, "");
const denyPolicyMigration = readFileSync(
  "supabase/migrations/20260729172438_v2_web_vitals_explicit_deny_policy.sql",
  "utf8",
);
const edgeFunction = readFileSync(
  "supabase/functions/v2-web-vitals/index.ts",
  "utf8",
);
const config = readFileSync("supabase/config.toml", "utf8");

describe("Core Web Vitals ingestion contract", () => {
  it("validates the identity-free payload and derives protected fields", () => {
    const result = validateWebVitalBatch({
      route: "/skills",
      viewport_width: 1440,
      metrics: [{
        name: "INP",
        value: 190,
        id: "v6-123-abc",
        navigation_type: "navigate",
      }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(toSamples(result.value, "preview")).toEqual([{
      metric_name: "INP",
      value: 190,
      rating: "good",
      route_path: "/skills",
      device_class: "desktop",
      environment: "preview",
      navigation_type: "navigate",
      metric_id: "v6-123-abc",
    }]);
  });

  it("rejects sensitive URL components and unknown identity fields", () => {
    expect(validateWebVitalBatch({
      route: "/skills?email=private@example.com",
      viewport_width: 390,
      metrics: [{
        name: "CLS",
        value: 0.02,
        id: "v6-123-def",
        navigation_type: "reload",
      }],
    })).toEqual({ ok: false, error: "invalid_route" });
    expect(validateWebVitalBatch({
      route: "/skills",
      viewport_width: 390,
      user_id: "not-allowed",
      metrics: [{
        name: "CLS",
        value: 0.02,
        id: "v6-123-def",
        navigation_type: "reload",
      }],
    })).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("uses exact origins and canonical thresholds", () => {
    expect(environmentForOrigin("https://jojoprompts.com")).toBe("production");
    expect(environmentForOrigin("https://jojoprompts.com.evil.test")).toBeNull();
    expect(ratingForMetric("LCP", 2500)).toBe("good");
    expect(ratingForMetric("INP", 501)).toBe("poor");
    expect(ratingForMetric("CLS", 0.101)).toBe("needs-improvement");
  });

  it("keeps the table RLS-closed and aggregation admin-only", () => {
    expect(migration).toContain(
      "ALTER TABLE public.web_vital_samples ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE public\.web_vital_samples FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toContain("percentile_cont(0.75)");
    expect(migration).toContain(
      "public.has_role(v_actor, 'admin'::public.app_role)",
    );
    expect(migration).toContain("interval '90 days'");
    expect(denyPolicyMigration).toMatch(
      /CREATE POLICY web_vital_samples_deny_direct_access[\s\S]*?AS RESTRICTIVE[\s\S]*?TO anon, authenticated[\s\S]*?USING \(false\)[\s\S]*?WITH CHECK \(false\)/,
    );
    expect(executableMigration).not.toMatch(
      /\b(user_id|email|ip_address|user_agent|query_string|dom_target)\b/i,
    );
  });

  it("exposes only the validated Edge Function ingestion path", () => {
    expect(config).toMatch(
      /\[functions\.v2-web-vitals\]\s+verify_jwt = false/,
    );
    expect(edgeFunction).toContain("environmentForOrigin(origin)");
    expect(edgeFunction).toContain("MAX_BODY_BYTES = 4 * 1024");
    expect(edgeFunction).toContain("ignoreDuplicates: true");
    expect(edgeFunction).not.toMatch(
      /console\.(?:log|error)\([^)]*(?:payload|origin|requestKey)/,
    );
  });
});

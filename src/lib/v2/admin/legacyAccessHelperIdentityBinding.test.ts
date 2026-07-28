import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260728175430_harden_legacy_access_helper_identity_binding.sql",
  "utf8",
);

const signatures = [
  "public.has_role",
  "public.can_manage_prompts",
  "public.get_user_subscription_tier",
  "public.can_access_tier",
  "public.can_access_prompt",
  "public.user_has_active_subscription",
] as const;

describe("legacy access-helper identity binding migration", () => {
  it("hardens exactly the six reviewed customer/RLS helpers", () => {
    for (const signature of signatures) {
      expect(migration.includes(`CREATE OR REPLACE FUNCTION ${signature}`)).toBe(
        true,
      );
    }
    expect(
      (
        migration.match(
          /CREATE OR REPLACE FUNCTION public\.(?:has_role|can_manage_prompts|get_user_subscription_tier|can_access_tier|can_access_prompt|user_has_active_subscription)/g,
        ) ?? []
      ).length,
    ).toBe(6);
  });

  it("pins every SECURITY DEFINER search path and qualifies table access", () => {
    expect((migration.match(/\nSECURITY DEFINER\n/g) ?? []).length).toBe(6);
    expect((migration.match(/SET search_path = ''/g) ?? []).length).toBe(6);

    for (const table of [
      "public.user_roles",
      "public.user_subscriptions",
      "public.subscription_plans",
      "public.prompts",
      "public.categories",
    ]) {
      expect(migration.includes(table)).toBe(true);
    }
  });

  it("binds cross-account calls to the actor unless admin or trusted server", () => {
    expect(migration.includes("auth.uid()")).toBe(true);
    expect(migration.includes("auth.jwt() ->> 'role'")).toBe(true);
    expect(migration.includes("session_user IN ('postgres', 'service_role')")).toBe(
      true,
    );
    expect(migration.includes("IS DISTINCT FROM v_actor")).toBe(true);
    expect(migration.includes("'admin'::public.app_role")).toBe(true);
    expect(migration.includes("v_subject := v_actor")).toBe(true);
  });

  it("fails anonymous role and prompt-management probes closed", () => {
    const hasRoleBody = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.has_role"),
      migration.indexOf(
        "CREATE OR REPLACE FUNCTION public.can_manage_prompts",
      ),
    );
    const canManageBody = migration.slice(
      migration.indexOf(
        "CREATE OR REPLACE FUNCTION public.can_manage_prompts",
      ),
      migration.indexOf(
        "CREATE OR REPLACE FUNCTION public.get_user_subscription_tier",
      ),
    );

    expect(hasRoleBody.includes("IF NOT v_trusted_server")).toBe(true);
    expect(hasRoleBody.includes("RETURN false")).toBe(true);
    expect(canManageBody.includes("IF NOT v_trusted_server")).toBe(true);
    expect(canManageBody.includes("RETURN false")).toBe(true);
  });

  it("preserves the narrow execution matrix", () => {
    expect(
      /GRANT EXECUTE ON FUNCTION public\.has_role[\s\S]*TO anon, authenticated, service_role;/.test(
        migration,
      ),
    ).toBe(true);
    expect(
      /GRANT EXECUTE ON FUNCTION public\.can_manage_prompts[\s\S]*TO anon, authenticated, service_role;/.test(
        migration,
      ),
    ).toBe(true);

    for (const signature of [
      "get_user_subscription_tier",
      "can_access_tier",
      "can_access_prompt",
      "user_has_active_subscription",
    ]) {
      const grant = new RegExp(
        `GRANT EXECUTE ON FUNCTION public\\.${signature}[\\s\\S]{0,120}TO authenticated, service_role;`,
      );
      expect(grant.test(migration)).toBe(true);
    }
  });

  it("contains no data mutation or destructive schema operation", () => {
    const stripped = migration
      .replace(/--.*$/gm, "")
      .replace(/\$\$[\s\S]*?\$\$/g, "");
    expect(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/i.test(stripped)).toBe(
      false,
    );
  });
});

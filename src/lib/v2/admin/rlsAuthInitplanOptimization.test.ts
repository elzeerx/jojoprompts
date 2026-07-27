import { describe, it, expect } from "bun:test";
import {
  V2_RLS_AUTH_INITPLAN as F,
  V2_RLS_AUTH_INITPLAN_APPLIED_LIVE,
  V2_RLS_AUTH_INITPLAN_MIGRATION_FILENAME as FILENAME,
  V2_RLS_AUTH_INITPLAN_REWRITE as REWRITE,
} from "./rlsAuthInitplanOptimization.sql";

describe("V2 RLS auth.uid init-plan optimization — applied-source record", () => {
  it("names the exact applied migration", () => {
    expect(FILENAME).toBe(
      "20260727140943_optimize_v2_rls_auth_initplans.sql",
    );
    expect(F.filename).toBe(FILENAME);
  });

  it("is marked as applied live", () => {
    expect(F.applied).toBe(true);
    expect(V2_RLS_AUTH_INITPLAN_APPLIED_LIVE.applied).toBe(true);
    expect(V2_RLS_AUTH_INITPLAN_APPLIED_LIVE.version).toBe("20260727140943");
    expect(V2_RLS_AUTH_INITPLAN_APPLIED_LIVE.name).toBe(
      "optimize_v2_rls_auth_initplans",
    );
  });

  it("records the exact rewrite contract (auth.uid() -> (select auth.uid()))", () => {
    expect(REWRITE.from).toBe("auth.uid()");
    expect(REWRITE.to).toBe("(select auth.uid())");
  });

  it("declares semantics preserved and access NOT broadened", () => {
    expect(REWRITE.semanticsPreserved).toBe(true);
    expect(REWRITE.broadensAccess).toBe(false);
  });

  it("scopes the rewrite to USING / WITH CHECK expressions on V2 core policies", () => {
    expect(REWRITE.scope).toContain("USING");
    expect(REWRITE.scope).toContain("WITH CHECK");
    expect(/V2 core/i.test(REWRITE.scope)).toBe(true);
  });
});

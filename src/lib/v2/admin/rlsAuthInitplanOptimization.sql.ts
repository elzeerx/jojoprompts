/**
 * SOURCE FIXTURE — V2 core RLS `auth.uid()` init-plan optimization.
 *
 * APPLIED LIVE. This file is retained as a version-controlled, testable
 * record of the applied optimization pass. Do NOT create a duplicate
 * executable migration file — the migration already exists in the
 * database catalog:
 *
 *   20260727140943 optimize_v2_rls_auth_initplans
 *
 * WHAT CHANGED (semantics preserved — performance only):
 *   • Rewrote `auth.uid()` calls inside V2 core RLS policies to
 *     `(select auth.uid())`. Postgres evaluates the scalar sub-select
 *     once per statement (as an InitPlan) instead of once per row,
 *     which eliminates the per-row function call overhead flagged by
 *     the Supabase advisor `auth_rls_initplan`.
 *   • Policy USING / WITH CHECK boolean shape is identical. No
 *     policy was added, removed, or renamed. No role list was
 *     changed. No admin/public/owner scope was broadened. No table
 *     grants were changed.
 *
 * OUT OF SCOPE (this fixture must not describe or imply):
 *   • Adding, dropping, or renaming policies.
 *   • Changing FOR clauses (SELECT/INSERT/UPDATE/DELETE/ALL).
 *   • Changing TO role lists (anon/authenticated/service_role).
 *   • Any GRANT / REVOKE.
 *   • Any change to `has_role`, `_v2_require_admin`, security-definer
 *     functions, or RPC surfaces.
 *   • Any storage / auth schema change.
 *
 * Rollback: revert each affected policy body to use `auth.uid()`
 * directly. No data migration is involved.
 */

export const V2_RLS_AUTH_INITPLAN_MIGRATION_FILENAME =
  "20260727140943_optimize_v2_rls_auth_initplans.sql";

export const V2_RLS_AUTH_INITPLAN_APPLIED_LIVE = {
  version: "20260727140943",
  name: "optimize_v2_rls_auth_initplans",
  applied: true,
} as const;

/**
 * The exact rewrite contract applied across V2 core policies:
 *   auth.uid()  ➜  (select auth.uid())
 * inside USING / WITH CHECK expressions only.
 */
export const V2_RLS_AUTH_INITPLAN_REWRITE = {
  from: "auth.uid()",
  to: "(select auth.uid())",
  scope: "V2 core RLS policy USING / WITH CHECK expressions",
  semanticsPreserved: true,
  broadensAccess: false,
} as const;

export const V2_RLS_AUTH_INITPLAN = {
  filename: V2_RLS_AUTH_INITPLAN_MIGRATION_FILENAME,
  applied: true,
  rewrite: V2_RLS_AUTH_INITPLAN_REWRITE,
} as const;

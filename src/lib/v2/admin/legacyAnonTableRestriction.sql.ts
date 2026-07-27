/**
 * SOURCE FIXTURE — pre-launch restriction of legacy anon-visible public
 * tables that were surfaced by past `GRANT ... TO anon` but are no
 * longer consumed by any active V2 public route.
 *
 * APPLIED LIVE:
 *   20260727142841 restrict_legacy_anon_table_surface
 *
 * EXACT FINAL ACTION (verbatim):
 *   REVOKE ALL PRIVILEGES ON TABLE public.collection_prompts FROM anon;
 *   REVOKE ALL PRIVILEGES ON TABLE public.collections FROM anon;
 *   REVOKE ALL PRIVILEGES ON TABLE public.prompt_generator_templates FROM anon;
 *   REVOKE ALL PRIVILEGES ON TABLE public.prompt_templates FROM anon;
 *   REVOKE ALL PRIVILEGES ON TABLE public.subscription_plans FROM anon;
 *
 * INVARIANTS:
 *   • Authenticated and service_role privileges are UNCHANGED.
 *   • All RLS policies are UNCHANGED (no CREATE/DROP/ALTER POLICY).
 *   • No table data is mutated (no INSERT/UPDATE/DELETE).
 *   • No table structure is altered (no ALTER TABLE ... ADD/DROP COLUMN).
 *
 * INTENTIONALLY PRESERVED ANON-VISIBLE TABLES (11 — public V2 surfaces
 * required pre-sign-in for discovery, licence/permission badges, and
 * bundle/version display):
 *   categories, installation_guides, licenses, platform_compatibility,
 *   platform_fields, platforms, product_bundle_items, products,
 *   resource_permissions, resource_versions, resources.
 *
 * OUT OF SCOPE — this fixture must NOT reference storage.*, function
 * grants, RLS policy bodies, or any table not listed above.
 */

export const LEGACY_ANON_RESTRICTION_MIGRATION = {
  version: "20260727142841",
  name: "restrict_legacy_anon_table_surface",
  filename: "20260727142841_restrict_legacy_anon_table_surface.sql",
  applied: true,
  authoritative: true,
} as const;

/** Exact five tables whose anon privileges were fully revoked. */
export const LEGACY_ANON_RESTRICTED_TABLES: readonly string[] = [
  "collection_prompts",
  "collections",
  "prompt_generator_templates",
  "prompt_templates",
  "subscription_plans",
] as const;

/** Exact 11 tables that remain intentionally anon-visible. */
export const LEGACY_ANON_PRESERVED_TABLES: readonly string[] = [
  "categories",
  "installation_guides",
  "licenses",
  "platform_compatibility",
  "platform_fields",
  "platforms",
  "product_bundle_items",
  "products",
  "resource_permissions",
  "resource_versions",
  "resources",
] as const;

/** Exact SQL applied live, in order. Used for contract assertions. */
export const LEGACY_ANON_RESTRICTION_SQL: readonly string[] = [
  "REVOKE ALL PRIVILEGES ON TABLE public.collection_prompts FROM anon;",
  "REVOKE ALL PRIVILEGES ON TABLE public.collections FROM anon;",
  "REVOKE ALL PRIVILEGES ON TABLE public.prompt_generator_templates FROM anon;",
  "REVOKE ALL PRIVILEGES ON TABLE public.prompt_templates FROM anon;",
  "REVOKE ALL PRIVILEGES ON TABLE public.subscription_plans FROM anon;",
] as const;

export const LEGACY_ANON_TABLE_RESTRICTION = {
  migration: LEGACY_ANON_RESTRICTION_MIGRATION,
  restricted: LEGACY_ANON_RESTRICTED_TABLES,
  preserved: LEGACY_ANON_PRESERVED_TABLES,
  sql: LEGACY_ANON_RESTRICTION_SQL,
  guarantees: {
    authenticatedUnchanged: true,
    serviceRoleUnchanged: true,
    rlsPoliciesUnchanged: true,
    noDataMutation: true,
    noStructuralChange: true,
  },
} as const;

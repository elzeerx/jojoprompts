# Supabase Advisor Triage — 2026-07-29

Project: `fxkqgjakbyrxkmevkglv`

This is a read-only production-state review. No DDL, data mutation, function
deployment, or website publication was performed.

## Snapshot

Security advisors:

- 179 total: 176 warnings, 3 informational.
- 0 error-level findings.
- 3 RLS-enabled tables with no policies.
- 1 extension-in-public warning (`pg_net`).
- 11 anonymous GraphQL-visible catalog tables.
- 80 authenticated GraphQL-visible tables/views.
- 6 anonymous-executable `SECURITY DEFINER` functions.
- 78 authenticated-executable `SECURITY DEFINER` functions.

Performance advisors:

- 368 total: 284 warnings, 84 informational.
- 18 unindexed foreign keys.
- 88 RLS init-plan optimizations.
- 65 unused-index notices.
- 196 multiple-permissive-policy notices.
- 1 Auth connection-allocation notice.

These counts are a drift baseline, not a blanket pass/fail result.

## Security disposition

### RLS enabled with no policy — accepted fail-closed service tables

- `package_scan_items`
- `payment_attempts`
- `v2_provider_status_rate_limit`

RLS with no applicable policy denies web-role access. These tables are
service-owned state and intentionally expose no anonymous/authenticated row
policy. Do not add a permissive policy merely to silence the advisor.

Reference:
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

### Anonymous GraphQL visibility — intentional public catalog

The 11 warned objects are the public discovery taxonomy/catalog:

- `categories`
- `installation_guides`
- `licenses`
- `platform_compatibility`
- `platform_fields`
- `platforms`
- `product_bundle_items`
- `products`
- `resource_permissions`
- `resource_versions`
- `resources`

Public browsing is a locked V2 requirement. Visibility is intentional, but
the post-migration gate must confirm that reusable prompt/skill content is
only in `private.resource_version_contents`, that public policies return only
published/non-archived records, and that file paths/secrets/private package
content are not exposed.

Reference:
https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed

### Authenticated GraphQL visibility — RLS/grant review, not a bypass finding

The advisor reports objects for which `authenticated` has table-level
`SELECT`; it does not prove that RLS returns another user's/admin data.
Customer-owned tables and direct Admin V2 queries require the web-role grant.
Legacy/internal tables remain discoverable in the API schema and are a future
surface-reduction opportunity.

Before launch, rerun the advisor after the three pending migrations and
execute customer/admin negative-access probes for orders, entitlements,
payment events, refunds, scans, activity/security logs, profiles/roles,
AI drafts, and private version content. Any returned unauthorized row is a
release blocker; schema discoverability alone is not.

Reference:
https://supabase.com/docs/guides/database/database-linter?lint=0027_pg_graphql_authenticated_table_exposed

### Anonymous `SECURITY DEFINER` execution — reviewed

Intentional public read RPCs:

- `get_public_profile_safe(uuid)`
- `get_public_prompt_previews(integer)`
- `get_public_resource_trust_badges(uuid[])`

Principal-bound boolean helpers:

- `can_manage_prompts(uuid)`
- `has_role(uuid, app_role)`
- `is_admin()`

The live definitions were inspected directly. `can_manage_prompts` and
`has_role` return false for anonymous callers unless the session is a trusted
server context; authenticated callers may query themselves, while cross-user
checks require an admin actor. `is_admin()` delegates to the bound
`has_role(auth.uid(), 'admin')`. These functions reveal at most a boolean and
are also used by RLS/publishing guards.

Revoking anonymous execute may be desirable for the three role helpers, but
must first be rehearsed against every public RLS policy that calls them.
Do not make that grant change directly in production to silence the advisor.

Reference:
https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

### Authenticated `SECURITY DEFINER` execution — guard coverage confirmed

A live catalog query inspected all 78 executable definitions. The only
functions without an explicit actor/admin/server marker were the three
intentional public read RPCs above. Every mutation, admin read, customer
read, cleanup, export, entitlement, checkout-state, and migration RPC had an
`auth.uid`, `auth.jwt`, `_v2_require_admin`, `is_admin`, `has_role`,
`session_user`, or equivalent principal guard.

Critical legacy samples were inspected in full:

- `admin_delete_user_data(uuid)` requires `is_admin()`.
- `cancel_user_subscription(uuid, uuid)` requires `is_admin()` and binds the
  supplied admin id to `auth.uid()`.
- `cleanup_expired_data()` rejects non-admin authenticated callers.
- `cleanup_orphaned_security_logs(integer)` requires `is_admin()`.
- `export_user_data(uuid)` allows self or admin only.

Static marker coverage is not a substitute for negative runtime tests. The
post-migration customer/admin probe remains mandatory.

Reference:
https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

### `pg_net` in public schema — documented follow-up

Moving an installed extension can affect cron/webhook dependencies and should
be rehearsed separately. No application table or function is made readable
by the extension's schema location alone. Keep this as a tracked hardening
follow-up unless a branch rehearsal proves a no-impact move.

Reference:
https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public

## Performance disposition

The performance findings are not authorization or correctness failures.
Several V2 foreign-key/index and RLS init-plan migrations are already live;
the remaining warnings are dominated by archival V1 tables and overlapping
legacy policies.

Do not drop "unused" indexes or merge policies immediately before launch
without workload evidence. After launch stability:

1. Prioritize V2 tables with measured slow queries.
2. Add missing covering indexes for active joins/deletes.
3. Replace per-row `auth.*` calls with `(select auth.*)` in active policies.
4. Consolidate duplicate permissive policies while preserving admin/self
   semantics.
5. Recheck advisor counts and query plans.

## Pre-launch advisor gate

After applying the pending migrations:

1. Run both advisor types again.
2. Diff counts and object names against this snapshot.
3. Require zero error-level security findings.
4. Prove public catalog columns and private version content boundaries.
5. Run anonymous/customer/admin negative-access probes.
6. Document any new warning or changed disposition before disabling Coming
   Soon.

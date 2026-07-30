# Supabase Advisor Triage — 2026-07-29

Project: `fxkqgjakbyrxkmevkglv`

The initial section is the read-only pre-deployment snapshot; the final
section records the later read-only refresh after the separately approved
controlled deployment. This document does not authorize website publication.

## Initial pre-deployment snapshot

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

The security and performance advisors were refreshed at
`2026-07-29T13:56Z`. Counts and finding categories were unchanged, and the
refresh still reported zero error-level security findings. Production
migration history also remained unchanged at
`20260728175807_harden_legacy_access_helper_identity_binding`; none of the four
frozen V2 release migrations had been applied.

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

The controlled deployment reran the advisor after the release migrations and
executed customer/admin negative-access probes for orders, entitlements,
payment events, refunds, scans, activity/security logs, profiles/roles,
AI drafts, and private version content. No unauthorized row was returned.
Schema discoverability alone is not treated as a bypass.

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

## Controlled advisor gate

Completed after applying the controlled migrations:

1. Ran both advisor types again.
2. Diffed counts and object names against the initial snapshot.
3. Confirmed zero error-level security findings.
4. Proved public catalog columns and private version content boundaries.
5. Ran anonymous/customer/admin negative-access probes.
6. Documented every new warning and disposition below. Repeat this gate before disabling Coming
   Soon.

## Post-deployment refresh

Refreshed after the controlled V2 deployment on 2026-07-29.

The inventories were fetched again after frontend receipt-resend activation.
There was no intervening DDL: security still has zero error-level findings and
the reviewed warning/informational objects and performance dispositions are
unchanged.

Security advisors:

- 184 total: 179 warnings, 5 informational, 0 errors.
- The four-finding increase is fully explained by the reviewed release
  migrations:
  - Informational: `private.resource_version_contents` and
    `public.v2_order_receipt_resend_payloads` have RLS enabled with no policy.
    Both are intentionally fail-closed service/private stores.
  - Warning: `public.v2_order_receipt_resend_requests` is visible to the
    authenticated API role. Its RLS policies restrict rows to the requesting
    customer or an authorized admin; direct negative-access probes passed.
  - Warning: the entitlement-checked
    `v2_get_entitled_resource_content(uuid)` RPC is executable by authenticated
    users. The function binds the actor to `auth.uid()`, requires a current
    entitlement (or full admin preview), and explicitly denies legacy
    `jadmin` bypasses. Anonymous, unentitled-customer, and unentitled-`jadmin`
    probes failed closed.
- Anonymous catalog visibility, anonymous executable helper count, and the
  `pg_net` disposition are unchanged.
- The field-monitoring addition contributes one authenticated-executable
  `SECURITY DEFINER` warning for `get_admin_v2_web_vitals(integer,text)`.
  Execute is revoked from anonymous users; authenticated callers still must
  pass the internal `has_role(auth.uid(), 'admin')` check. Direct
  anonymous/authenticated table grants are revoked, and the sample table has
  an explicit restrictive deny policy. The telemetry table has no remaining
  security-advisor notice.

Performance advisors:

- 377 total: 284 warnings and 93 informational.
- Warning count is unchanged.
- The eight informational additions are five unindexed-foreign-key notices
  and three unused-index notices introduced by the new release tables.
  Immediately dropping or adding indexes without production workload evidence
  would add more release risk than it removes; retain the existing
  post-stability performance disposition.
- The single additional informational notice is the new
  `web_vital_samples_dashboard_idx` being unused before public traffic exists.
  It directly supports the environment/metric/device/time p75 query and should
  be retained through the launch ramp.

Post-deployment authorization and integrity probes confirmed:

- No anonymous/authenticated direct read of private version content or receipt
  payloads.
- Public version metadata is pinned to the explicit latest published version.
- No unauthorized customer/admin rows were returned by the reviewed V2
  boundaries.
- No orphaned commerce/resource rows, duplicate external payment events,
  order-total mismatches, paid-allocation overflow, missing file integrity, or
  published-version pointer mismatches were found.

These advisor deltas are accepted for the locked release candidate. They do
not authorize disabling Coming Soon.

## Stability close-out refresh — 2026-07-30

The advisors were rerun after the original 24-hour gate elapsed and before the
absolute production-lock correction was published.

- Security remains 184 total: 179 warnings, 5 informational, 0 errors. Object
  categories and the reviewed dispositions above are unchanged.
- Performance is 374 total: 284 warnings and 90 informational. Warning count
  and object categories are unchanged. Three prior `unused_index`
  informational notices are absent from the refreshed workload snapshot; this
  is positive statistics drift, not DDL or a policy/index change.

The corrective frontend commit contains no database migration or Edge
Function change. The advisor result remains the applicable baseline for the
new locked window and does not authorize public launch.

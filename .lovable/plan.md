
# Audit: JojoPrompts state after Phase 6B.2 real migration + launch lock

## 1. Completed phases (evidence from repo)

- **Phase 1** — Signup trigger fix. `supabase/migrations/20251025_fix_signup_trigger.sql`, `docs/PHASE1_SIGNUP_FIX.md`.
- **Phase 2** — Signup robustness (retry/error codes). `src/utils/signupErrorHandler.ts`, `docs/PHASE2_ROBUSTNESS.md`.
- **Phase 3** — Signup docs. `docs/SIGNUP_FLOW.md`, `docs/TESTING_CHECKLIST.md`.
- **Security phases 1–3** — Payment validation, rate limiting, compliance. `docs/SECURITY_PHASE2_PAYMENT_VALIDATION.md`, `docs/SECURITY_PHASE3_RATE_LIMITING_COMPLIANCE.md`, `PHASE_1_SECURITY_FIXES_COMPLETE.md`.
- **Admin refactor Phases 1–2** — `ADMIN_REFACTOR_PHASE_1_COMPLETE.md`, `PHASE_2_ADMIN_REFACTOR_COMPLETE.md`, `src/pages/admin/sections/*` (ai-studio, analytics, catalog, communications, content, orders, overview, publishing, system).
- **Code-quality Phases 2–6** (sessions 1–29) — logs in `PHASE_2_SESSION_*`, `PHASE_4_LOGGING_COMPLETE.md`, `PHASE_5_TYPES_COMPLETE.md`, `PHASE_6_CLEANUP_COMPLETE.md`.
- **V2 foundation** — `src/config/v2Flags.ts` (`V2_COMMERCE_ENABLED = false`), resource types, `/skills` `/automations` `/prompts-catalog` `/image-styles` `/bundles` `/cart` `/library` `/v2-checkout*` pages, `src/hooks/v2/*`.
- **V2 UPayments plumbing (execution-gated)** — `supabase/functions/_shared/v2Upayments.ts` gated on `V2_UPAYMENTS_ENABLED="true"` (currently unset); `v2-upayments-webhook`, `process-upayments-payment`; migration `20260723072257_…` establishes provider-disabled default.
- **Phase 6B.1** — Grandfathering policy + legacy access RPCs; migrations `20260724062655`, `20260724063802`, `20260724064749`, `20260724071501`, `20260724072543`. RPCs `v2_admin_migration_preview`, `v2_my_legacy_access_summary`, `v2_admin_migration_rehearsal`. UI: `src/pages/admin/sections/publishing/LegacyMigrationPreview.tsx`, `src/hooks/v2/useMyLegacyAccessSummary.ts`, `LibraryPage.tsx` legacy section.
- **Phase 6B.2** — Private executor + hashes. Migrations `20260724074013` (private schema, `execute_v2_legacy_migration`, plan hashes `6B.2-r1`), `20260724074210`, `20260724074300`, `20260724075202` (security cleanup: drop `_rehearsal_log`, revoke on `supabase_read_only_user`, restrict private fn EXECUTE to owner). Frontend: `useAdminCommerce.ts` `RehearsalResult`, `LegacyMigrationPreview` RehearsalCard with `planned_writes`.
- **Real migration executed** — 116 entitlements / 96 users, 56 lifetime credit entries, audit event `1040e421-…`, replay = 0 (per prompt; matches deterministic plan sizes in `private.v2_legacy_entitlement_plan` / `v2_legacy_credit_plan`).
- **Launch lock** — `src/config/siteMode.ts` `PUBLIC_LAUNCH_LOCK = true`; `src/pages/ComingSoonPage.tsx` gates public/customer routes in `src/App.tsx`; `LoginForm.tsx` hides signup; hosted Supabase signups disabled (external). Published commit `e14c78f3…`.

## 2. Single next unfinished bounded milestone

**Phase 6B.3 — Post-migration verification & admin observability (read-only)**.

Purpose: give admins a live, evidence-backed view that the executed 6B.2-r1 migration matches the deterministic plan, that customer-facing legacy access renders correctly, and that no drift has been introduced — all under the existing launch lock. No new writes, no provider calls, no publish.

## 3. Files / functions / routes to change

**Database (forward-only, read-only)**
- New migration `supabase/migrations/<ts>_v2_migration_verification.sql`:
  - `public.v2_admin_migration_verification()` SECURITY DEFINER, admin-only, locked `search_path`. Returns JSON:
    - `policy_version` `'6B.2-r1'`, current `plan_hashes` from `private.v2_legacy_plan_hashes()`.
    - `expected` counts from `private.v2_legacy_entitlement_plan()` / `v2_legacy_credit_plan()` (116 / 56, 96 unique users).
    - `actual` counts from `entitlements` filtered by `source in ('legacy_basic','legacy_standard','legacy_premium','legacy_ultimate')` and `lifetime_credit_entries` filtered by `source='legacy_upayments_reconstruction'` / `legacy_transaction_id IS NOT NULL`.
    - `drift`: per-user set differences (missing / extra / mismatched `resource_scope`/`end_date`), capped to first N rows.
    - `last_audit_event_id`, timestamp, executed_by.
  - Reuses existing plan functions in `private`; no writes; no changes to executor or hashes.

**Frontend (admin only)**
- `src/hooks/admin/v2/useAdminCommerce.ts`: add typed `useMigrationVerification()` calling the new RPC.
- `src/pages/admin/sections/publishing/LegacyMigrationPreview.tsx`: add a "Post-migration verification" card below the Rehearsal card — shows expected vs actual, hash match badge, drift list (empty state = "No drift"), and last audit event id. Fully defensive optional chaining.
- No changes to `src/config/siteMode.ts`, `siteMode` gating, `V2_COMMERCE_ENABLED`, `V2_UPAYMENTS_ENABLED`, `ComingSoonPage`, or `LoginForm`.

**Routes**
- Reuses existing `/admin/publishing/imports`. No new public routes.

**Acceptance tests**
- `npx tsgo --noEmit` clean; `npm run build` succeeds.
- `SELECT public.v2_admin_migration_verification()` as an admin returns `expected.entitlements=116`, `expected.credits=56`, `actual.entitlements=116`, `actual.credits=56`, `drift.entitlements=[]`, `drift.credits=[]`, `hashes_match=true`.
- Same call as anon/non-admin → permission error.
- `/admin/publishing/imports` renders the verification card with green "in sync" state; no console errors.
- Non-admin visitors to any public route still land on Coming Soon (unchanged).
- `entitlements` and `lifetime_credit_entries` row counts unchanged before/after (read-only proof).

**Safety constraints**
- No writes to `entitlements`, `lifetime_credit_entries`, `orders`, `transactions`, V1 subscriptions/transactions.
- No changes to `private.execute_v2_legacy_migration`, hash constants, or `policy_version`.
- No provider calls; `V2_UPAYMENTS_ENABLED` remains unset.
- No changes to launch lock, hosted signup, or published commit.
- New RPC gated by `has_role(auth.uid(),'admin')`; `search_path=public,pg_temp`; `SECURITY DEFINER`; `REVOKE ALL … FROM PUBLIC`; `GRANT EXECUTE … TO authenticated` with in-function admin check.

## 4. Blocked without live UPayments creds or a production-release decision

- Setting `V2_UPAYMENTS_ENABLED=true`, real order creation, checkout, webhook verification against sandbox/production UPayments.
- Any test that requires a real KWD charge or provider callback signature.
- Flipping `V2_COMMERCE_ENABLED=true` or exposing V2 catalog/checkout routes publicly.
- Flipping `PUBLIC_LAUNCH_LOCK=false` or re-enabling hosted Supabase signups.
- Any creator-marketplace / subscription work (explicitly out of scope per user).

Phase 6B.3 as scoped does **not** require any of the above.

## 5. Recommendation

**Yes — implement Phase 6B.3 now under the launch lock.** It is:
- Read-only and provider-independent, so it cannot destabilize the completed 6B.2 migration or the published Coming Soon commit.
- Directly valuable: it converts the one-shot rolled-back rehearsal + audit event into an ongoing admin-visible integrity check that will keep paying off through the eventual unlock.
- The natural predecessor to the eventual (separately-approved) V2 commerce unlock, since unlock QA will want a green "migration in sync" indicator.

Everything beyond 6B.3 (UPayments enablement, V2 commerce unlock, public unlock) should remain deferred behind an explicit production-release decision.

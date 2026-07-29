# JojoPrompts V2 Release Readiness

Last updated: 2026-07-29

Requirement-by-requirement evidence and residual gates are tracked in
`docs/V2_REQUIREMENTS_COVERAGE.md`.

The exact reviewed commit, migration hashes, function rollback versions,
production baseline, deployment order, and stop conditions are frozen in
`docs/V2_CONTROLLED_DEPLOYMENT_MANIFEST_2026-07-29.md`.

## Current release posture

- Production URL: `https://jojoprompts.com`
- Supabase project: `fxkqgjakbyrxkmevkglv`
- Lovable project: `766f3370-d38c-42e5-8566-5e4946986dd2`
- Production launch lock: **ON**
- Admin/customer runtime sync: **complete through `082505f2`**
- Performance/mobile-card runtime sync: **complete**
- Privacy-safe field performance monitoring: **deployed and preview-verified**
- Audited admin receipt resend: **activated and preview-verified; no QA email sent**
- Production migration apply: **complete and reconciled**
- Edge Function deployment: **complete and fetched back**
- Final rendered Lovable QA: **desktop/mobile English/Arabic pass completed;
  post-performance Explore smoke pass completed**

`PUBLIC_LAUNCH_LOCK` must remain `true` through migration, function, frontend,
and production-locked smoke verification. Disabling Coming Soon is a separate
final launch decision.

The controlled deployment completed without removing Coming Soon. Remaining
public-launch gates are tracked below; completion of the deployment pass is
not public-launch approval.

The legacy Auth reconciliation is also complete: production has 247 Auth
users, 247 profiles, no orphan rows, no missing roles, and unchanged commerce
and entitlement totals.

## Local completion evidence

The local V2 implementation includes:

- Dedicated Admin V2 shell, operations tables, publishing, orders, users,
  communications, trust/activity, and settings.
- Public V2 discovery, details, cart, checkout, pricing, account, and library.
- One-time UPayments commerce and permanent entitlements/lifetime credit.
- Private versioned content and entitlement-checked signed downloads.
- Cloudmersive package scanning with fail-closed effective state.
- English/Arabic responsive surfaces and V2 route/security contracts.
- 24 legacy Edge Functions verified live as 410, plus a source-only
  `magic-login` retirement prepared for the controlled deployment.

Canonical local gate:

```bash
bun run verify:v2
```

Latest controlled-deployment result on 2026-07-29: TypeScript and scoped V2
lint passed, all 929 tests passed, and the production build completed
successfully. The gate must pass again after the post-deployment release-matrix
tests and immediately before the public launch change.

The controlled deployment reran the gate successfully (929/929 tests and a
production build). A post-QA admin-sidebar touch-target regression test also
passes at the synced release-candidate head.

The final performance/provider/profile release gate also passes: TypeScript,
scoped lint, 961/961 tests, and the production build completed successfully.
Lighthouse and synced-preview evidence is recorded in
`docs/V2_PERFORMANCE_EVIDENCE_2026-07-29.md`.

## Security review closure

- Codex Security diff scan `95a2265c-60b9-48bd-ab3c-7ae4c02d00dc`
  reviewed all 85 changed files between the current Lovable commit and the
  frozen V2 source.
- The scan found one medium authorization issue and one low metadata-exposure
  issue:
  - Legacy `jadmin` users could bypass V2 protected-content entitlements.
  - Public readers could see draft version metadata beneath a published
    resource.
- Both findings are corrected in commit
  `48978150b042bf33c6e0ae7d5660fccc63768f18` and migration
  `20260729163600_close_v2_security_review_findings.sql`.
- Focused authorization suites passed 88/88 tests, the full V2 gate passed
  929/929 tests, and a real PostgreSQL 16 rehearsal confirmed:
  - Full admins retain authorized content access.
  - Unentitled `jadmin` and customer identities are denied.
  - Entitled customers retain version-pinned access.
  - Anonymous readers see only the explicit latest published version.
  - Archived owners see the published version but not its drafts.
  - A published-version pointer with a null `published_at` fails closed.

## Production database migrations

The release migrations below are applied and reconciled in production:

1. `20260728152000_admin_receipt_resend_requests.sql`
   - Adds the independent, audited admin receipt-resend state machine.
   - Its live function bundles and production boundaries passed the activation
     gate; `ADMIN_RECEIPT_RESEND_ENABLED=true`.
2. `20260728185445_secure_versioned_resource_content.sql`
   - Moves reusable resource content into a private version-pinned store.
   - Backfills the latest published-version pointer and adds immutability,
     entitlement, admin-content, and publication contracts.
3. `20260728214500_fix_active_v2_rpc_schema_drift.sql`
   - Aligns active library, order, entitlement, free-acquisition, metrics,
     activity, and publishing RPC output with the current V2 schema.
4. `20260729163600_close_v2_security_review_findings.sql`
   - Removes the legacy `jadmin` bypass from protected V2 resource content.
   - Restricts public and archived-owner version metadata to the explicit
     latest published version.
   - Includes migration-time assertions for both authorization invariants.
5. `20260729171000_reconcile_missing_auth_profiles.sql`
   - Applied through the Supabase migration API as production version
     `20260729163554`.
   - Reconciles missing Auth profiles and missing ordinary roles
     idempotently without touching commerce, entitlements, or lifetime credit.
6. `20260729171438_v2_web_vitals_rum.sql`
   - Adds identity-free Core Web Vitals samples, admin-only aggregation, and
     90-day retention.
7. `20260729172438_v2_web_vitals_explicit_deny_policy.sql`
   - Adds the explicit restrictive deny policy to the RLS-protected sample
     store.

### Completed migration preflight

- Captured a restricted Supabase backup/restore point.
- Recorded counts and sums for users, resources, versions, files, products,
  orders, order items, payment events, refunds, entitlements, lifetime-credit
  entries, and historical transactions.
- Rehearsed the authorization migration in PostgreSQL 16, applied the reviewed
  chain in order, and reconciled production after each controlled stage. A
  full from-zero local CLI bootstrap is not
  accepted as release evidence until the historical 2024 storage migration's
  removed `storage.create_bucket()` helper is modernized.
- Refreshed Supabase advisors and found zero error-level security findings.
- Recorded the production migration list and verified all seven controlled
  payloads under their documented production versions/names.

### Migration verification

- Re-run the reconciliation counts and financial sums.
- Confirm public resource rows expose no reusable prompt/skill body.
- Confirm private version content has no authenticated/anonymous grants.
- Confirm admin content reads require an authorized role.
- Confirm an unentitled `jadmin` cannot read reusable V2 content.
- Confirm anonymous and ordinary authenticated readers see only the explicit
  latest published version, never draft or superseded version metadata.
- Confirm ownership checks pin to the purchased/current eligible major
  version and revoked/refunded access fails.
- Exercise each replaced RPC with anonymous, customer, and admin identities.
- Confirm receipt-resend tables/RPCs are invisible to customers.

## Edge Function deployment outcome

The four original functions with reviewed source deltas and the additive
field-monitoring function were deployed and fetched back:

### Identity/admin

- `get-all-users`
- `admin-bulk-confirm-users`

### Auth/legacy cleanup

- `magic-login` — source-only 410; V2 uses Supabase Auth
  `signInWithOtp`. The compatibility page redirects to `/login`.
- `enhance-prompt` — preserves its guarded compatibility helper and adds a
  POST-only method contract.

### Field monitoring

- `v2-web-vitals` — exact-origin, identity-free RUM ingest with strict input
  bounds and server-derived environment/device/rating.

### Verification-only live targets

The following functions are already live and have no source delta in the
frozen runtime release. Do not redeploy them merely to refresh a version
number:

- `resource-download`
- `v2-upayments-checkout`
- `v2-upayments-refund`
- `v2-upayments-status`
- `v2-upayments-webhook`
- `v2-admin-resend-order-receipt`
- `v2-admin-upload-resource-file`
- `v2-admin-package-scan-control`
- `v2-package-scan-worker`

### Function verification

- Fetch each changed deployed source or source hash and compare it to the
  reviewed local commit. Verify the unchanged live targets through their
  contract probes and recorded live versions.
- Confirm `magic-login` returns the exact 410 JSON contract.
- Confirm admin functions reject missing/customer bearer tokens.
- Confirm resource download rejects missing, expired, refunded, revoked,
  version-mismatched, and scan-blocked access.
- Confirm receipt resend is idempotent and ambiguous provider outcomes enter
  reconciliation rather than causing a second send.
- Confirm duplicate/delayed payment callbacks do not duplicate settlement,
  ownership, lifetime credit, or email delivery.

This section passed. `ADMIN_RECEIPT_RESEND_ENABLED=true` shipped in reviewed
frontend commit `082505f2`; the confirmation dialog was opened and cancelled
without sending an email or creating a resend request.

## Frontend sync and QA

1. Commit the reviewed local changes without unrelated duplicate files.
2. Push/sync the exact commit to Lovable while the launch lock is still on.
3. Build the Lovable preview and record the preview commit/hash.
4. Run rendered QA on:
   - Desktop and mobile.
   - English and Arabic/RTL.
   - Anonymous, customer, admin, and insufficient-role sessions.
   - Keyboard navigation, focus visibility, labels, dialogs, zoom, and
     reduced motion.
5. Validate Admin V2:
   - Overview attention queues and metrics.
   - Catalog filters, saved views, pagination, bulk actions, archive/restore.
   - Publisher draft → validation → review → publish → new version.
   - Package upload → scan → publish block/allow behavior.
   - Orders, payment events, refunds, recovery, entitlements, discounts.
   - User creation/edit/password/role/bulk actions.
   - Templates, delivery health, security activity, storage/integrations.
6. Validate public/customer V2:
   - Explore/search/filter/quick preview and resource detail.
   - Free acquisition and duplicate prevention.
   - Cart and authoritative pricing.
   - Successful, failed, cancelled, retried, duplicate, mismatched, and
     refunded sandbox payments.
   - Lifetime credit threshold and refund reversal.
   - My Library, version visibility, signed download, receipt, and install
     guidance.
   - Legacy URL redirects and canonical/share metadata.

Rendered QA cannot be replaced by source tests. It must run against the synced
Lovable preview because the local in-app browser origin is unavailable in this
workspace.

## Rollback

- Frontend: keep the previous Lovable version available and never combine the
  launch-lock change with the main V2 sync.
- Edge Functions: record deployed version IDs before replacement; rollback by
  redeploying the immediately prior reviewed source.
- Database: the seven controlled migrations are forward-only. Use the preflight restore
  point for catastrophic rollback; prefer a reviewed corrective migration for
  non-destructive schema/RPC defects.
- Payments: keep new checkout unavailable during rollback. Never point new
  traffic at legacy PayPal or V1 UPayments functions.
- Customer rights: do not delete or rewrite historical transactions,
  entitlements, access dates, original currencies, or refund records.

## Final launch gate

Coming Soon may be disabled only when all items below have evidence:

- Local `verify:v2` passes.
- Production dependency audit is reviewed and current.
- Supabase security/performance advisors are re-run and diffed against
  `docs/security/SUPABASE_ADVISOR_TRIAGE_2026-07-29.md`.
- Backup and restore evidence exists.
- All seven controlled migrations are applied and reconciled.
- Exact Edge Function bundle is deployed and fetched back.
- UPayments live sandbox success/failure and refund-submission evidence is
  recorded; cancel/retry/mismatch/idempotency and the sandbox-only refund
  limitation are covered by deterministic fail-closed contracts.
- Cloudmersive live benign evidence is recorded; malicious/unavailable and
  retry-exhaustion behavior is covered by deterministic tests against the
  deployed shared decision helpers.
- Lovable desktop/mobile English/Arabic QA passes.
- Production remains stable under the launch lock through the restarted
  24-hour window ending no earlier than 2026-07-30 17:39 UTC.
- Field p75 LCP, INP, and CLS monitoring is enabled for the launch ramp, with
  stop/rollback thresholds matching the locked targets.
- Monitoring, support, and rollback owners are confirmed.
- A separate explicit approval is given to set `PUBLIC_LAUNCH_LOCK=false`
  and publish that single launch change.

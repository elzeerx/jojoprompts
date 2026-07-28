# JojoPrompts V2 Release Readiness

Last updated: 2026-07-29

Requirement-by-requirement evidence and residual gates are tracked in
`docs/V2_REQUIREMENTS_COVERAGE.md`.

## Current release posture

- Production URL: `https://jojoprompts.com`
- Supabase project: `fxkqgjakbyrxkmevkglv`
- Lovable project: `766f3370-d38c-42e5-8566-5e4946986dd2`
- Production launch lock: **ON**
- Admin/customer frontend sync: **pending explicit approval**
- Production migration apply: **pending explicit approval**
- Edge Function deployment: **pending explicit approval**
- Final rendered Lovable QA: **pending frontend sync**

`PUBLIC_LAUNCH_LOCK` must remain `true` through migration, function, frontend,
and production-locked smoke verification. Disabling Coming Soon is a separate
final launch decision.

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

Latest local result on 2026-07-29: TypeScript and scoped V2 lint passed, all
927 tests passed, and the production build completed successfully. The gate
must pass again from a clean dependency install immediately before sync.

## Pending database migrations

Apply in timestamp order only:

1. `20260728152000_admin_receipt_resend_requests.sql`
   - Adds the independent, audited admin receipt-resend state machine.
   - UI remains gated by `ADMIN_RECEIPT_RESEND_ENABLED=false` until its
     function bundle is deployed and verified.
2. `20260728185445_secure_versioned_resource_content.sql`
   - Moves reusable resource content into a private version-pinned store.
   - Backfills the latest published-version pointer and adds immutability,
     entitlement, admin-content, and publication contracts.
3. `20260728214500_fix_active_v2_rpc_schema_drift.sql`
   - Aligns active library, order, entitlement, free-acquisition, metrics,
     activity, and publishing RPC output with the current V2 schema.

### Migration preflight

- Capture a current Supabase backup/restore point.
- Record counts and sums for users, resources, versions, files, products,
  orders, order items, payment events, refunds, entitlements, lifetime-credit
  entries, and historical transactions.
- Run the same migration chain against a fresh isolated database.
- Run `supabase db lint` with no errors.
- Record the current production migration list and verify that none of the
  three timestamps is already applied under a different name.

### Migration verification

- Re-run the reconciliation counts and financial sums.
- Confirm public resource rows expose no reusable prompt/skill body.
- Confirm private version content has no authenticated/anonymous grants.
- Confirm admin content reads require an authorized role.
- Confirm ownership checks pin to the purchased/current eligible major
  version and revoked/refunded access fails.
- Exercise each replaced RPC with anonymous, customer, and admin identities.
- Confirm receipt-resend tables/RPCs are invisible to customers.

## Edge Function deployment bundle

Deploy reviewed source only after the migrations it depends on:

### Identity/admin

- `get-all-users`
- `admin-bulk-confirm-users`

### Resource delivery

- `resource-download`

### Receipt delivery

- `v2-upayments-webhook`
- `v2-upayments-status`
- `v2-admin-resend-order-receipt`

The webhook and status functions must be redeployed because their shared
receipt module is bundled into each deployed function version.

### Auth/legacy cleanup

- `magic-login` — source-only 410; V2 uses Supabase Auth
  `signInWithOtp`. The compatibility page redirects to `/login`.
- `enhance-prompt` — preserves its guarded compatibility helper and adds a
  POST-only method contract.

### Function verification

- Fetch each deployed source or source hash and compare it to the reviewed
  local commit.
- Confirm `magic-login` returns the exact 410 JSON contract.
- Confirm admin functions reject missing/customer bearer tokens.
- Confirm resource download rejects missing, expired, refunded, revoked,
  version-mismatched, and scan-blocked access.
- Confirm receipt resend is idempotent and ambiguous provider outcomes enter
  reconciliation rather than causing a second send.
- Confirm duplicate/delayed payment callbacks do not duplicate settlement,
  ownership, lifetime credit, or email delivery.

Only after this section passes may
`ADMIN_RECEIPT_RESEND_ENABLED` change to `true` in a reviewed frontend commit.

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
- Database: the three migrations are forward-only. Use the preflight restore
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
- All three migrations are applied and reconciled.
- Exact Edge Function bundle is deployed and fetched back.
- UPayments sandbox success/failure/cancel/refund/retry cases pass.
- Cloudmersive benign/malicious/unavailable cases pass.
- Lovable desktop/mobile English/Arabic QA passes.
- Production remains stable under the launch lock for the agreed window.
- Monitoring, support, and rollback owners are identified.
- A separate explicit approval is given to set `PUBLIC_LAUNCH_LOCK=false`
  and publish that single launch change.

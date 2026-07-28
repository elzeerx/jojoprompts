# JojoPrompts V2 Controlled Deployment Manifest

Prepared: 2026-07-29

Production project: `fxkqgjakbyrxkmevkglv`

Lovable project: `766f3370-d38c-42e5-8566-5e4946986dd2`

This document freezes the reviewed release inputs and rollback references. It
does not authorize a production mutation or the public launch. Coming Soon and
`PUBLIC_LAUNCH_LOCK=true` remain mandatory throughout the controlled
deployment and stability checks.

## Release source

- Reviewed local commit: `5f92502ebbb302f44111e2c746bb40f1fad3a709`
- Current Lovable commit: `8d1f2206f533cdc491224ab36d2157b9b045969e`
- Relationship: the reviewed release is four commits ahead of Lovable.
- Canonical gate on the reviewed commit:
  - TypeScript: passed.
  - Scoped V2 lint: passed.
  - Tests: 927 passed, 0 failed.
  - Production build: passed.

Commit sequence to sync:

1. `e8f161217da715e730e18dc402fc9d1f09bf39a6`
   `feat: complete V2 resource security and admin hardening`
2. `582bc596eda094e0b6ccb6137db84b31a6c039cf`
   `chore: close V2 admin release readiness gaps`
3. `96ac3fe9ff9d9be1bb2957ece156b092debbc0df`
   `docs: record Supabase release advisor triage`
4. `5f92502ebbb302f44111e2c746bb40f1fad3a709`
   `feat: close V2 requirement coverage gaps`

## Database migration payload

Apply only in timestamp order after recording a recoverable production restore
point and the reconciliation baseline.

| Order | Migration | SHA-256 | Lines | Bytes |
|---:|---|---|---:|---:|
| 1 | `20260728152000_admin_receipt_resend_requests.sql` | `c8ee2ab9490d96c7464ea21625fa2687b1b85d39f55f83f760b0124658ee770b` | 631 | 23,637 |
| 2 | `20260728185445_secure_versioned_resource_content.sql` | `7c04d6ef6276c9a6f948f2d91a18f83afa58ab8ac23d8e279ff2527759a92a10` | 1,528 | 44,248 |
| 3 | `20260728214500_fix_active_v2_rpc_schema_drift.sql` | `a86a6b121bf30357edf75dfc8582815f226e448b3f7323e0d59b9104ec8704a7` | 1,160 | 31,857 |

Production migration history currently ends at
`20260728175807_harden_legacy_access_helper_identity_binding`. None of the
three timestamps above is recorded in production.

## Edge Function delta and rollback versions

Only functions with a reviewed source delta from the current Lovable release
belong in the deployment mutation set.

| Function | `verify_jwt` | Current live version | Local deterministic bundle hash | Required outcome |
|---|---:|---:|---|---|
| `get-all-users` | `true` | 607 | `bb53bf89eb6a8e9889d2468c84a8fb541aa892ed915e84380576f2f3c7557da5` | Deploy hardened admin/user handlers |
| `admin-bulk-confirm-users` | `true` | 85 | `7b1b180055fe56a26bddce16c4486d593c81b7ba28814b33168c8331bbbb0a3f` | Deploy hardened bulk confirmation |
| `enhance-prompt` | `false` | 249 | `3cc018dd981244279b45a698bdcec5674c157c286a805c571a0fa4d8d8a78ffb` | Preserve body authentication and add strict method handling |
| `magic-login` | `false` | 195 | `eb9d586fd5328558b6ac363ff333339e22c83808706e21a2fc2a283b4aa478ac` | Replace legacy privileged login flow with the reviewed HTTP 410 retirement stub |

The live version numbers above are rollback references, not proof that source
can be reconstructed from version metadata. Before replacing a function,
fetch and retain its full deployed source bundle.

The following V2 functions are already live and have no source delta in the
four-commit release range, so they are verification targets rather than
automatic redeployment targets:

- `resource-download`
- `v2-upayments-checkout`
- `v2-upayments-refund`
- `v2-upayments-status`
- `v2-upayments-webhook`
- `v2-admin-resend-order-receipt`
- `v2-admin-upload-resource-file`
- `v2-admin-package-scan-control`
- `v2-package-scan-worker`

The receipt-resend UI must remain gated by
`ADMIN_RECEIPT_RESEND_ENABLED=false` until migration 1 and its live function
pass the resend/reconciliation test matrix.

## Read-only production baseline

Captured at `2026-07-28T22:09:13.485Z` (2026-07-29 Kuwait time):

| Measure | Value |
|---|---:|
| Auth users | 247 |
| Resources / versions / files | 66 / 66 / 1 |
| Products | 66 |
| Orders | 3 |
| Order status | 1 paid, 2 failed |
| Paid order value | 900 fils |
| Order items / payment events | 3 / 11 |
| Refunds | 1 failed |
| Completed refund value | 0 fils |
| Entitlements / active entitlements | 117 / 117 |
| Lifetime-credit entries | 57 |
| Lifetime-credit net | 1,138,170 fils |
| Legacy transactions / completed | 180 / 102 |
| Legacy completed value | USD 4,035.80 |
| Package scans | 1 |

No customer-identifying values are included. Re-run the same aggregate
immediately before and after migration and compare every value. Expected
changes must be explained by the migration or by activity during the window.

## Controlled order of operations

1. Confirm explicit deployment approval; do not treat approval as launch
   approval.
2. Record a recoverable production restore point.
3. Re-run the read-only baseline and record current migration/function
   versions.
4. Re-run `bun run verify:v2` from the exact reviewed source.
5. Sync the four commits to Lovable while the launch lock remains on.
6. Apply the three migrations in the frozen order and verify each migration
   history entry before proceeding.
7. Fetch and retain the current source for each function in the mutation set.
8. Deploy the four changed functions with the frozen `verify_jwt` settings.
9. Fetch the deployed sources back and compare them with the local bundles.
10. Run database, role, payment, refund, receipt, download, and scan probes.
11. Run Lovable Preview QA for admin, customer, anonymous, and
    insufficient-role users on desktop/mobile and English/Arabic.
12. Re-run Supabase security/performance advisors and reconcile the baseline.
13. Keep Coming Soon enabled for the stability window.
14. Perform the final evidence audit.
15. Request a separate explicit approval for the single launch-lock change.

## Stop conditions

Stop the rollout before the next mutation if any of these occur:

- A migration checksum differs from this manifest.
- Migration history is unexpected or a timestamp already exists under another
  payload.
- A backup/restore point cannot be confirmed.
- Any migration reports an error or post-migration contract probe fails.
- A deployed function cannot be fetched back or differs from reviewed source.
- Admin authorization, customer isolation, ownership, or signed-download
  checks fail.
- UPayments amount, currency, customer, status, idempotency, or refund
  reconciliation fails.
- The post-deployment baseline shows an unexplained loss of users, customer
  rights, orders, financial records, files, or historical transactions.
- Coming Soon or the launch lock becomes disabled before final approval.

## Platform-change review

The current Supabase changelog review identified two relevant upcoming
behaviors:

- Explicit Postgres extension version pinning is deprecated from 2026-08-05.
  The release migrations contain no extension version pins.
- Public tables may no longer be automatically exposed to the Data API.
  The release migrations use explicit grants and RLS for browser-facing
  objects; service-only payload/content objects remain unexposed.

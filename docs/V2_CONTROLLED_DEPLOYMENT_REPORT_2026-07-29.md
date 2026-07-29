# JojoPrompts V2 Controlled Deployment Report — 2026-07-29

## Outcome

The approved controlled V2 deployment pass completed while the production
launch lock remained enabled. This report is deployment evidence, not public
launch approval.

Release-candidate source:

- Git/Lovable head: `bf5b73473b204657b21109adb81d32db7c488c48`
- Production launch lock: `PUBLIC_LAUNCH_LOCK = true`
- Production HTML: `JojoPrompts — Coming soon`, `noindex,nofollow`

## Applied database migrations

The four reviewed migrations were applied in order and recorded in production:

1. `20260728152000_admin_receipt_resend_requests`
2. `20260728185445_secure_versioned_resource_content`
3. `20260728214500_fix_active_v2_rpc_schema_drift`
4. `20260729163600_close_v2_security_review_findings`

Post-migration reconciliation:

- Auth users: 247
- Profiles: 243
- Resources / published resources: 66 / 65
- Resource versions / files: 66 / 1
- Products: 66
- Orders: 3 (1 paid, 2 failed), 900 paid fils
- Order items / payment events: 3 / 11
- Refunds: 1 (failed sandbox refund; no processed value)
- Entitlements: 117 total / 117 active
- Lifetime credit: 57 entries / 1,138,170 net fils
- Package scans: 1 total / 1 clean

The financial and catalog totals match the pre-deployment baseline.

## Edge Functions

Reviewed changed functions were deployed and fetched back byte-for-byte:

- `get-all-users`
- `admin-bulk-confirm-users`
- `enhance-prompt`
- `magic-login`

Unchanged checkout, status, webhook, refund, receipt, download, upload, and
scan functions were contract-probed without unnecessary redeployment.
Authentication, method, retired-410, and fail-closed probes behaved as
expected.

## Rendered QA

Validated against the locked Lovable preview:

- Desktop and 390x844 mobile layouts.
- English and Arabic with `dir=rtl`.
- Public Home, Explore, resource details, My Library, and mobile filters.
- Admin Overview, Catalog, Publisher, Orders, Refunds, Recovery, Users,
  Package Scans, Payments, Communications, Trust/Activity, and Settings.
- No page-level horizontal overflow on the tested public/customer/admin
  routes.
- Public and page-level admin controls meet the 44px mobile target. A 32px
  admin-sidebar target discovered during QA was corrected and locked by a
  regression test at the release-candidate head.
- No browser console errors were observed during the route sweep.

Local verification:

- TypeScript: pass
- Scoped V2/admin lint: pass
- Tests: 929 pass / 0 fail
- Production build: pass

## Security and advisor refresh

- Security: 183 total, 178 warnings, 5 informational, 0 errors.
- Performance: 376 total, 284 warnings, 92 informational.
- New security notices are the reviewed fail-closed private/receipt stores,
  scoped receipt-request visibility, and the principal-bound entitlement
  content RPC.
- Performance warning count is unchanged; eight informational notices came
  from the new release-table indexes/foreign keys.

See `docs/security/SUPABASE_ADVISOR_TRIAGE_2026-07-29.md` for the disposition.

## Backup and rollback evidence

A restricted backup directory contains the pre-deployment schema, data, roles,
storage inventory, hashes, restore caveat, and the prior source of the four
changed Edge Functions:

`/Users/elzeer/Documents/Codex/jojoprompts-v2-release-backup-20260729`

The database migrations are forward-only. Use a reviewed corrective migration
for non-destructive defects and the captured restore point only for
catastrophic rollback.

## Remaining public-launch gates

Do not remove Coming Soon until all of the following are resolved or explicitly
accepted:

1. Reconcile four older, confirmed Auth users that have no matching
   `public.profiles` row. No existing profile is orphaned and none of the four
   accounts currently has a V2 entitlement.
2. Reconfirm the dependency audit immediately before launch and check for a
   stable patched React Router release; keep the documented non-RSC exception
   if none exists.
3. Complete the agreed production-locked stability window and assign named
   monitoring, support, and rollback owners.
4. Record final live-provider evidence for the agreed UPayments
   success/failure/cancel/retry/refund matrix and Cloudmersive
   benign/malicious/unavailable matrix, or explicitly accept the tested
   fail-closed coverage where a sandbox cannot produce a provider-success
   state.
5. Obtain a separate explicit approval for the single launch-lock change.

No public launch action was performed in this deployment pass.

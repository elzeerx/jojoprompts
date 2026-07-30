# JojoPrompts V2 Controlled Deployment Report — 2026-07-29

## Outcome

The approved controlled V2 deployment pass completed while the production
launch lock remained enabled. This report is deployment evidence, not public
launch approval.

The project owner reconfirmed approval for the controlled V2 deployment pass
in the Codex task on 2026-07-29. That approval covers the locked deployment and
verification work recorded here; it does not authorize changing
`PUBLIC_LAUNCH_LOCK`.

Release-candidate source:

- Controlled-deployment head: `54db8e18`
- Post-deployment Auth reconciliation head synced to Lovable: `a3cc49bc`
- Performance/mobile-card runtime head synced to Lovable: `797fc7cf`
- Field-performance monitoring head synced to Lovable: `ee2edd2d`
- Receipt-resend activation head synced to Lovable: `082505f2`
- Admin accessibility runtime head synced to Lovable: `d397c76f`
- Production launch lock: `PUBLIC_LAUNCH_LOCK = true`
- Production HTML: `JojoPrompts — Coming soon`, `noindex,nofollow`

## Applied database migrations

The four reviewed release migrations were applied in order and recorded in
production:

1. `20260728152000_admin_receipt_resend_requests`
2. `20260728185445_secure_versioned_resource_content`
3. `20260728214500_fix_active_v2_rpc_schema_drift`
4. `20260729163600_close_v2_security_review_findings`

The post-deployment Auth reconciliation was then applied as the reviewed,
idempotent migration `reconcile_missing_auth_profiles`, recorded in production
as version `20260729163554`. It inserted only missing profile rows, preserved
existing roles, granted the ordinary `user` role only where no role existed,
and did not touch commerce or entitlements.

Two additive field-performance migrations were then applied after the fifth,
Auth-reconciliation migration:

- `v2_web_vitals_rum`
- `v2_web_vitals_explicit_deny_policy`

They add an identity-free Core Web Vitals sample store, admin-only p75
aggregation, 90-day retention, revoked browser grants, RLS, and an explicit
restrictive deny policy. They do not change accounts, catalog, orders,
payments, refunds, entitlements, or lifetime credit.

Post-migration reconciliation:

- Auth users: 247
- Profiles: 247
- Auth without profile / profile without Auth / profile without role: 0 / 0 / 0
- Resources / published resources: 66 / 65
- Resource versions / files: 66 / 1
- Products: 66
- Orders: 3 (1 paid, 2 failed), 900 paid fils
- Order items / payment events: 3 / 11
- Refunds: 1 (failed sandbox refund; no processed value)
- Entitlements: 117 total / 117 active
- Lifetime credit: 57 entries / 1,138,170 net fils
- Package scans: 1 total / 1 clean

The financial and catalog totals match the pre-deployment baseline. The Auth
reconciliation left orders (3), payment events (11), entitlements (117), and
lifetime-credit entries (57) unchanged.

## Edge Functions

Reviewed changed functions were deployed and fetched back byte-for-byte:

- `get-all-users`
- `admin-bulk-confirm-users`
- `enhance-prompt`
- `magic-login`
- `v2-web-vitals`

Unchanged checkout, status, webhook, refund, receipt, download, upload, and
scan functions were contract-probed without unnecessary redeployment.
Authentication, method, retired-410, and fail-closed probes behaved as
expected.

Before activating receipt resend, the live `v2-upayments-webhook` version 52,
`v2-upayments-status` version 51, and
`v2-admin-resend-order-receipt` version 3 bundles were fetched and matched to
the reviewed source, including the direct REST `Idempotency-Key` header. The
receipt tables, RLS, and seven service-only mutation RPC grants passed
production checks. The synced admin action then passed desktop and 390x844
mobile QA. Its confirmation dialog was opened and cancelled; no email, resend
request, or provider payload was created.

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
- The Core Web Vitals admin panel passed desktop and 390x844 responsive QA,
  including production/preview separation and honest insufficient-sample
  states.
- A final semantic sweep found that `SidebarInset` and `AdminLayout` both
  rendered `main`, and found placeholder-only publisher/commerce controls.
  Runtime `d397c76f` removes the nested landmark and gives the affected
  controls stable accessible names. The synced Admin Overview, Publisher,
  Orders, Payment Events, Entitlements, Refunds, Recovery, Discounts, and
  Transactional Templates routes now expose one `main`, no nested `main`, no
  unnamed primary controls, and no page-level horizontal overflow.

Local verification:

- TypeScript: pass
- Scoped V2/admin lint: pass
- Tests: 929 pass / 0 fail at controlled deployment
- Final performance and field-monitoring release gate: 961 tests pass / 0 fail
- Final accessibility runtime gate: 970 tests pass / 0 fail
- Production build: pass

The canonical full gate passed after the release-matrix tests and evidence
documents were added.

## Performance and final Explore QA

The Explore route now renders a lightweight heading/SEO shell before loading
catalog data, cards, filters, and lifetime state. Production HTML no longer
requests the unused GPT Engineer editor helper, and the regular Forma brand
font is preloaded. A mobile visual-card positioning defect found during final
QA was corrected so the title/price gradient no longer covers version, update,
and trust metadata.

Final local Lighthouse lab evidence:

- Mobile: score 79, FCP 2.43s, LCP 4.81s, CLS 0.00014, TBT 10ms.
- Desktop: score 99, FCP 0.51s, LCP 0.95s, CLS 0.00004, TBT 0ms.

Mobile lab LCP remains above the locked target, and lab TBT does not prove
field p75 INP. This is recorded as a launch-ramp monitoring gate rather than a
false pass. See `docs/V2_PERFORMANCE_EVIDENCE_2026-07-29.md`.

Lovable reported `797fc7cf` ready at 2026-07-29 17:06:17 UTC. The synced
desktop and 390x844 mobile Explore route then passed Arabic RTL, catalog,
quick-preview, card-legibility, and console-health checks.

Privacy-safe field monitoring was then deployed in `ee2edd2d`, which Lovable
reported ready at 2026-07-29 17:25:54 UTC. The endpoint accepted a controlled
preview-only LCP/INP/CLS batch, derived ratings/device/environment correctly,
rejected a spoofed origin with 403, rejected a query-bearing route with 400,
and the three synthetic samples were removed. Admin Overview passed desktop
and 390x844 QA with no horizontal overflow or console errors. Production
`/explore` continued to render Coming Soon.

## Security and advisor refresh

- Security: 184 total, 179 warnings, 5 informational, 0 errors.
- Performance: 377 total, 284 warnings, 93 informational.
- New security notices are the reviewed fail-closed private/receipt stores,
  scoped receipt-request visibility, and the principal-bound entitlement
  content RPC.
- Performance warning count is unchanged; eight informational notices came
  from the new release-table indexes/foreign keys.

See `docs/security/SUPABASE_ADVISOR_TRIAGE_2026-07-29.md` for the disposition.

## Provider release matrix

Provider evidence is closed using the strongest safe evidence each sandbox can
produce:

- UPayments live sandbox: one captured 0.900 KWD payment, failed payment
  attempts, status recovery, and a real refund submission.
- UPayments refund limitation: the sandbox returned HTTP 422 with
  `work_in_production_only`. The application recorded a failed refund attempt
  without revoking ownership or lifetime credit. A processed sandbox refund is
  impossible by provider contract.
- UPayments deterministic gate: exact status allowlists, cancelled-state
  handling, provider re-verification, amount/currency/identifier mismatch
  rejection, deterministic event IDs, database uniqueness, and non-mutating
  pending/unknown refund behavior are part of the canonical Bun suite.
- Cloudmersive live sandbox: the uploaded benign package completed with a clean
  scan.
- Cloudmersive deterministic gate: malicious/EICAR-equivalent responses,
  contradictory provider signals, blocked risks, malformed responses,
  unavailable/transient HTTP states, missing secrets, retry exhaustion, and
  aggregate publication blocking are part of the canonical Bun suite.

We did not deliberately upload malware to production storage or induce a real
provider outage. Those scenarios are covered by dependency-free fail-closed
tests against the same shared decision helpers used by the deployed worker.
See `docs/V2_PROVIDER_RELEASE_MATRIX_2026-07-29.md`.

## Initial stability observation

The reviewed performance/mobile-card runtime commit restarted the 24-hour
production-locked stability window, then field monitoring restarted it, and
the final audited receipt-resend frontend activation restarted it once more.
The Admin V2 accessibility runtime then restarted it again. The current
conservative window starts from Lovable head `d397c76f` after rendered QA and
production-lock verification at 2026-07-29 19:02 UTC
(22:02 Asia/Kuwait) and ends no earlier than 2026-07-30 19:02 UTC
(22:02 Asia/Kuwait).

The first log review found:

- Edge Functions: 92 returned events, 0 responses at 5xx.
- Auth and Storage: 0 error-severity events in the returned samples.
- Postgres: three recent fail-closed `security_logs` permission denials. The
  table intentionally has no anonymous grant, its authenticated admin read is
  RLS-protected, and the synced Security Events page subsequently loaded
  successfully without exposing unauthorized data. Controlled `/admin` and
  Security Events reloads produced no further database error. Recurrence
  remains a stability close-out watch item. Earlier schema/permission/enum
  errors map to controlled negative probes.
- Current integrity: 247 Auth users, 247 profiles, zero profile/role gaps,
  3 orders, 11 payment events, 117 entitlements, 57 lifetime-credit entries,
  and 1 package scan.

The close-out check and owner confirmation are tracked in
`docs/V2_STABILITY_AND_OPERATIONS_2026-07-29.md`.

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

1. Reconfirm the dependency audit immediately before launch and check for a
   stable patched React Router release; keep the documented non-RSC exception
   if none exists.
2. Complete the 24-hour production-locked stability window and confirm named
   monitoring, support, and rollback owners.
3. Record owner/legal acceptance of the bilingual Terms, Privacy, refund,
   lifetime-credit, and standard Jojo license wording.
4. Use the deployed field Core Web Vitals monitoring for the launch ramp and
   stop/rollback if p75 LCP, INP, or CLS remains outside the locked targets.
5. Obtain a separate explicit approval for the single launch-lock change.

Final 200% zoom, reduced-motion, keyboard-focus, landmark, accessible-name,
responsive-reflow, and Arabic RTL acceptance passed against synced runtime
`d397c76f` on 2026-07-30. See
`docs/V2_ACCESSIBILITY_ACCEPTANCE_2026-07-30.md`.

No public launch action was performed in this deployment pass.

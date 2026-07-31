# JojoPrompts V2 Stability and Operations Gate — 2026-07-29

## Current corrective locked window

- Start: 2026-07-30 19:20 UTC / 22:20 Asia/Kuwait.
- Earliest close: 2026-07-31 19:20 UTC / 22:20 Asia/Kuwait.
- Public launch lock: `PUBLIC_LAUNCH_LOCK = true` for the entire window.
- Lovable baseline: `6f6d1c90`.

Lovable synchronized `6f6d1c90` at 19:18:09 UTC, published the still-locked
build at 19:18:33 UTC, and the production route sweep completed at 19:19:52
UTC. The conservative clock therefore starts at 19:20 UTC.

## Superseded locked window

- Start: 2026-07-29 19:02 UTC / 22:02 Asia/Kuwait.
- Earliest close: 2026-07-30 19:02 UTC / 22:02 Asia/Kuwait.
- Public launch lock: `PUBLIC_LAUNCH_LOCK = true` for the entire window.
- Lovable baseline: `d397c76f`.

Any runtime source, migration, Edge Function, payment configuration, scanner
configuration, or launch-lock change restarts the window. Documentation and
test-only commits that do not alter the production bundle do not restart it.

The previous receipt-activation window was superseded by the reviewed Admin V2
accessibility runtime. Lovable reported `d397c76f` ready at
2026-07-29 18:29:39 UTC; the conservative full 24-hour clock starts after its
rendered semantic QA and production-lock verification completed at
19:02 UTC.

## Initial observation

- Lovable reports project ready at `d397c76f`.
- The synced Admin Overview, Publisher, Orders, Payment Events, Entitlements,
  Refunds, Recovery, Discounts, and Transactional Templates routes expose one
  `main`, no nested `main`, named primary controls, and no page-level
  horizontal overflow.
- Admin receipt resend is enabled for the eligible paid order. The bilingual
  confirmation dialog passed desktop and 390x844 QA and was cancelled before
  submission; production still has zero resend requests/payloads.
- The identity-free `v2-web-vitals` endpoint accepted a preview-only
  LCP/INP/CLS batch, derived environment/device/rating correctly, rejected a
  spoofed origin with 403, rejected a query-bearing path with 400, and the
  three synthetic samples were removed.
- The Admin Overview Core Web Vitals panel passed desktop and 390x844 mobile
  QA, has no horizontal overflow, and returns an honest “Collecting data”
  state below 75 samples. Production and preview data are separated.
- Synced desktop and 390x844 mobile Explore smoke checks passed in Arabic RTL,
  including catalog hydration and quick preview, with no console warnings or
  errors.
- Final technical accessibility acceptance passed at 200% browser zoom in
  English and Arabic, under reduced-motion emulation, and through keyboard,
  focus, landmark, accessible-name, reflow, and RTL checks. See
  `docs/V2_ACCESSIBILITY_ACCEPTANCE_2026-07-30.md`.
- The canonical local gate passes: typecheck, scoped lint, 970/970 tests, and
  production build.
- Performance evidence and the remaining field-data limitation are recorded in
  `docs/V2_PERFORMANCE_EVIDENCE_2026-07-29.md`.
- Post-activation samples: Edge Functions had 92 returned events with no 5xx;
  Auth and Storage had no error-severity events.
- Postgres contained three fail-closed `permission denied for table
  security_logs` entries at 17:28:39, 17:37:46, and 17:55:45 UTC. The table has no
  anonymous grant, the authenticated admin grant remains RLS-protected, the
  synced Security Events page subsequently loaded successfully, and no
  unauthorized data was returned. A controlled `/admin` reload at 18:00:36 UTC
  and a direct authorized Security Events load at 18:03:53 UTC did not produce
  another database error. Treat any further recurrence as a close-out
  investigation item rather than weakening the table boundary.
- Earlier schema, enum, and permission errors correspond to controlled
  negative probes and predate the receipt-activation baseline.
- Dependency refresh: production audit remains one non-reachable RSC-only
  React Router advisory represented by two high package nodes; full audit
  remains 0 critical, 9 high, 3 moderate, and 1 low. No stable patched router
  release exists, and the source still contains no RSC/server/action path.
- Database integrity: 247 Auth users, 247 profiles, no missing/orphan
  profile/role rows, 3 orders, 11 payment events, 117 entitlements, 57
  lifetime-credit entries, and 1 package scan.

## 2026-07-30 close-out result

The previous window fully elapsed, but it did **not** close successfully. Live
production verification found that `/login` still mounted the real sign-in
form and `/admin` redirected to it while Coming Soon was enabled. The source
lock was inside the routed/authenticated provider tree, so `AuthProvider`
could refresh an existing session before the wildcard Coming Soon route
rendered.

This finding also explains the 18:26 UTC production Auth activity and the
adjacent fail-closed `permission denied for table prompts` and
`permission denied for table user_roles` Postgres entries. No unauthorized
data was returned and no entitlement or commerce state changed, but the
surface violated the absolute launch-lock contract.

Corrective runtime `6f6d1c90` returns the inert locked app before
`QueryClientProvider`, `BrowserRouter`, `LanguageProvider`, `AuthProvider`,
OAuth, admin, or customer/public routes mount. After deployment, `/`,
`/login`, `/reset-password`, `/admin`, `/signup`, `/explore`, `/pricing`, and
`/.lovable/oauth/consent` all rendered the same Coming Soon document with
`noindex,nofollow` and zero forms, inputs, buttons, or links. No new Auth,
Storage, Edge Function, or Postgres event appeared during that production
sweep; the latest returned database errors still predated the corrective
deployment.

The refreshed reconciliation remained unchanged: 247 Auth users/profiles,
zero profile/role gaps, 3 orders, 11 payment events, 1 failed sandbox refund,
117 active entitlements, 57 lifetime-credit entries, and 1 clean package scan.
Security advisors remain 184 total (179 warning, 5 informational, 0 error).
Performance advisors are 374 total (284 warning, 90 informational); the three
fewer informational unused-index notices are workload-stat drift, not a schema
or warning-count change. Production/full dependency audits remain 0 critical,
2 high / 0 critical, 9 high, 3 moderate, 1 low respectively, with the same
non-reachable React Router RSC-only exception. The canonical gate at
`6f6d1c90` passed typecheck, scoped lint, 973 tests, and production build.

Because the correction changes production runtime behavior, it restarts the
full 24-hour window above.

## Close-out checks

At or after the earliest close:

1. Confirm Lovable still points to the intended release head and reports
   ready.
2. Confirm production still renders Coming Soon and remains `noindex,nofollow`.
3. Re-run the Supabase Edge Function, Postgres, Auth, and Storage log review.
4. Investigate every new 5xx, fatal, panic, or unexplained database error.
5. Re-run Auth/profile/role and commerce/entitlement reconciliation.
6. Re-run `bun run verify:v2`.
7. Re-run production and full dependency audits.
8. Re-run Supabase security/performance advisors and diff the baseline.
9. Confirm the field-performance endpoint, admin aggregation RPC, retention,
   and production/preview separation remain healthy.
10. Record the final monitoring, support, and rollback owners below.

## Owner confirmation

These roles must be filled by named people before public launch:

- Monitoring owner: **Nawaf Alsuwaiyed**
- Customer-support owner: **Nawaf Alsuwaiyed**
- Rollback decision owner: **Nawaf Alsuwaiyed**
- Technical rollback executor: **Nawaf Alsuwaiyed**

Owner confirmation recorded on 2026-08-01. One person intentionally holds all
four operational roles for the V2.0 launch; this does not replace the separate
business-owner/legal acceptance or public-launch approval.

The monitoring owner watches payment reconciliation, failed receipt delivery,
scan failures, error logs, and entitlement anomalies. The support owner handles
customer payment/access reports. The rollback decision owner authorizes
disabling new checkout or restoring Coming Soon. The technical executor
performs the reviewed rollback procedure.

## Stop conditions

Do not launch when any of the following is true:

- Any unexplained 5xx or repeated database error remains open.
- Auth/profile/role or financial reconciliation drifts.
- A provider mismatch grants entitlement or a refund removes the wrong access.
- A non-clean or stale package can be downloaded.
- The canonical build/test gate fails.
- Dependency or advisor review reveals an unaccepted critical/high risk.
- The confirmed operational owner is unavailable for the launch window.

## Rollback posture

- Frontend: re-enable or retain Coming Soon as the first containment action.
- Checkout: disable new UPayments checkout before touching historical records.
- Edge Functions: redeploy the immediately prior captured reviewed source.
- Database: prefer a corrective forward migration; use the restricted restore
  point only for a catastrophic rollback.
- Customer rights: never delete or rewrite historical payments, entitlements,
  access dates, original currencies, or refund records.

# JojoPrompts V2 Stability and Operations Gate — 2026-07-29

## Current corrective locked window

- Start: 2026-08-01 17:01:34 UTC / 2026-08-01 20:01:34 Asia/Kuwait.
- Earliest close: 2026-08-02 17:01:34 UTC / 2026-08-02 20:01:34 Asia/Kuwait.
- Public launch lock: `PUBLIC_LAUNCH_LOCK = true` for the entire window.
- Frontend baseline: `50c841bb57a02ab81c68984f515a5cc86df10566`, which contains
  the verified absolute-lock ancestor
  `6f6d1c9060db1a6eb1554ffa0c679d51cefb093e`.
- Database baseline: production migration
  `20260801170134_harden_legacy_transaction_and_discount_writes`. Local
  reviewed filename
  `20260801165606_harden_legacy_transaction_and_discount_writes.sql`,
  SHA-256 `5fe4e04440d3b9b539d0851bb675c91856660acabac482882a5bcddfc8f67fdc`,
  40 lines, 1,709 bytes.
- Edge Function baseline: `v2-admin-integrations-settings-status` version 15.

This window supersedes the 2026-08-01 11:22 UTC window because the reviewed
legacy transaction/discount write-hardening migration was applied to
production. Any further runtime source, migration, Edge Function,
payment/scanner configuration, or launch-lock change restarts the window.
Documentation-only synchronization does not restart it.

## Interim non-closing refresh — 2026-08-01 19:23 UTC

This refresh is evidence only. It is clean, but it does **not** close the gate
and must be rerun after 2026-08-02 17:01:34 UTC.

- Production lock sweep passed for `/`, `/login`, `/reset-password`, `/admin`,
  `/signup`, `/explore`, `/pricing`, and `/.lovable/oauth/consent`. Every route
  returned the same Coming Soon document from `index-D1yCI-OC.js` with
  `noindex,nofollow`, zero forms, inputs, buttons, or links, and no Supabase,
  Auth, Storage, REST, or Edge Function request.
- Logs: no Edge Function 5xx, fatal, or panic event. The only 403 was the
  expected web-vitals negative probe. Postgres returned 35 LOG events with no
  ERROR, FATAL, or PANIC. Auth traffic was known preview/QA activity with two
  stale refresh-token 400s. Storage had no 5xx; expired signed-image 400s were
  each followed by successful sign and render requests.
- Reconciliation unchanged: 247 Auth users, profiles, and role rows with zero
  gaps; 66 resources, 65 published, 66 versions, 1 file, and 66 products with
  zero integrity or pointer mismatches; 3 orders (1 paid, 2 failed), 3 order
  items, 11 payment events, and 1 failed sandbox refund with zero duplicate,
  orphan, total, or allocation issues; 117 active entitlements and 57 lifetime
  entries with zero orphans; 1 clean package scan; 0 receipt resends.
- Security advisors: 184 total = 179 warning, 5 informational, 0 error, with
  unchanged categories.
- Performance advisors: 369 total = 280 warning, 89 informational. Four fewer
  `multiple_permissive_policies` notices follow the applied hardening, and one
  fewer `unused_index` informational notice is workload-stat drift. No new
  category appeared.
- Dependencies: npm production audit 0 critical / 2 high; full audit 0
  critical / 3 high / 3 moderate / 1 low. The React Router RSC advisory remains
  architecture-unreachable; the source scan found no RSC, server-router, or
  action path. `react-router-dom` remains pinned to `7.18.1`; latest stable is
  `7.18.2` and no stable `8.3.0` is published.
- `bun run verify:v2` passed typecheck, scoped lint, 989 tests, and the
  production build.

## Superseded corrective locked window

- Start: 2026-08-01 11:22 UTC / 2026-08-01 14:22 Asia/Kuwait.
- Earliest close: 2026-08-02 11:22 UTC / 2026-08-02 14:22 Asia/Kuwait.
- Public launch lock: `PUBLIC_LAUNCH_LOCK = true` for the entire window.
- Lovable baseline: `50c841bb`.
- Edge Function baseline: `v2-admin-integrations-settings-status` version 15.

Lovable synchronized `50c841bb` and published the still-locked build at
approximately 11:20 UTC on 2026-08-01. Production and preview served the same
`index-D1yCI-OC.js` application artifact. The production `/`, `/admin`,
`/explore`, and `/login` sweep returned only Coming Soon with
`noindex,nofollow` and zero interactive controls before the conservative
11:22 UTC clock start.

This release keeps Explore search and filters in normal document flow so they
scroll away rather than cover catalog cards. Hosted desktop and 390x844 RTL
checks reported static positioning, zero overlap, and no horizontal overflow.
The mobile filter drawer opens and closes with an accessible title and
description and no browser warnings/errors. The canonical gate passed
TypeScript, scoped lint, 982 tests, and production build.


## Superseded legacy-image window

- Start: 2026-08-01 10:53 UTC / 2026-08-01 13:53 Asia/Kuwait.
- Earliest close: 2026-08-02 10:53 UTC / 2026-08-02 13:53 Asia/Kuwait.
- Public launch lock: `PUBLIC_LAUNCH_LOCK = true` for the entire window.
- Lovable baseline: `c493c1bd`.

The catalog filter-flow runtime correction superseded this window before it
elapsed. The private signed legacy-image resolver remains in the new baseline.

## Superseded route-consolidation window

- Start: 2026-07-31 23:33 UTC / 2026-08-01 02:33 Asia/Kuwait.
- Earliest close: 2026-08-01 23:33 UTC / 2026-08-02 02:33 Asia/Kuwait.
- Public launch lock: `PUBLIC_LAUNCH_LOCK = true` for the entire window.
- Lovable baseline: `3da31a69`.

The legacy-image runtime correction superseded this window before it elapsed.

The release reduces the admin sidebar from 31 operational destinations to six
workspaces: Overview, Content, Commerce, People, Operations, and Settings.
Category browsing is consolidated under `/explore?type=...`; old public and
admin bookmarks remain supported through bounded compatibility redirects.
The synchronized preview passed all workspace and redirect checks. Production
`/`, `/admin`, `/explore`, and `/login` still render only Coming Soon with
`noindex,nofollow` and no interactive controls.

Immediate baseline results: 247 Auth users and profiles with zero gaps, 3
orders, 11 payment events, 117 active entitlements, 57 lifetime-credit entries,
and 1 package scan. The last-20-minute log sample contained no Edge Function
5xx, fatal, or panic event and no Storage or Postgres error event. Security
advisors remain 184 total (179 warning, 5 informational); performance advisors
remain 374 total (284 warning, 90 informational). Production/full npm audits
remain 0 critical with 2 high / 3 high, 3 moderate, and 1 low respectively.
The canonical gate passed TypeScript, scoped lint, 977 tests, and the production
build.

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

## Close-out evidence — 2026-08-03 06:10 UTC

Close-out began at 2026-08-03 06:10 UTC / 09:10 Asia/Kuwait, after the
2026-08-02 17:01:34 UTC earliest-close time. `PUBLIC_LAUNCH_LOCK` remains
`true`; nothing was published or deployed and no runtime, test, migration,
function, package, or configuration file was changed.

- Production lock sweep passed for `/`, `/login`, `/reset-password`, `/admin`,
  `/signup`, `/explore`, `/pricing`, and `/.lovable/oauth/consent`. Every route
  still served `index-D1yCI-OC.js` and rendered Coming Soon with
  `noindex,nofollow` and zero forms, inputs, buttons, or links.
- Production remains the documented `50c841bb` runtime containing the verified
  absolute-lock ancestor `6f6d1c90`. The current `3e4a5cf7` preview head was
  **not** published.
- Edge Function baseline is `v2-admin-integrations-settings-status` version 15,
  deployed 2026-07-31 23:26:45 UTC, before this stability window. Earlier
  references to version 14 in this document were incorrect and are corrected.
- Supabase reconciliation: 247 Auth users, 247 profiles, 247 role users, zero
  missing rows or orphans; 3 orders, 11 payment events, 1 failed sandbox
  refund, 117 active entitlements, 57 lifetime-credit entries, 1 clean scan,
  0 receipt resend requests and 0 payloads. Orphan, duplicate-event, order
  formula/item total, paid-allocation, file-integrity, and published-version
  pointer checks were all zero.
- Logs: Edge Functions logged 17 events (7x202, 7x204, one controlled 400, two
  controlled 403) with no 5xx, fatal, or panic. Postgres logged 19 LOG events
  with no ERROR, FATAL, or PANIC. Storage logged 98x200, one stale
  signed-image 400, one cache event, and no 5xx.
- Field monitoring: 41 preview samples, zero production samples, zero samples
  older than 90 days. RLS/browser grant isolation, the admin aggregation RPC,
  the service-only retention RPC, and production/preview separation are intact.
- Advisors unchanged: security 184 = 179 warning + 5 informational + 0 error;
  performance 369 = 280 warning + 89 informational.
- Dependency audits unchanged: production 0 critical / 2 high; full 0 critical
  / 3 high / 3 moderate / 1 low. The npm latest stable `react-router-dom`
  remains `7.18.2`, and no RSC, server-router, action, or `ScrollRestoration`
  source path exists.
- `bun run verify:v2` passed typecheck, scoped lint, 996 tests, and the
  production build.

### Blocking Auth event — release blocked

At 2026-08-02 13:55:21 UTC a password-recovery request returned 500 because
Resend rejected the message: `noreply.jojoprompts.com` is not a verified
sending domain. Three adjacent invalid-credential 400s in the same period are
expected client failures and are not defects.

The release is **blocked** until the sender domain is verified or replaced and
a controlled recovery-email retest succeeds with clean Auth and delivery logs.

### Ownership and approval status

The operational owner remains **Nawaf Alsuwaiyed** for all four roles.
Owner/legal acceptance is still pending, and the separate public-launch
approval must not be requested until the email blocker above is cleared.

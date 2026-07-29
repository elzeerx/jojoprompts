# JojoPrompts V2 Stability and Operations Gate — 2026-07-29

## Locked window

- Start: 2026-07-29 16:36 UTC / 19:36 Asia/Kuwait.
- Earliest close: 2026-07-30 16:36 UTC / 19:36 Asia/Kuwait.
- Public launch lock: `PUBLIC_LAUNCH_LOCK = true` for the entire window.
- Lovable baseline: `a3cc49bc`.

Any runtime source, migration, Edge Function, payment configuration, scanner
configuration, or launch-lock change restarts the window. Documentation and
test-only commits that do not alter the production bundle do not restart it.

## Initial observation

- Lovable reports project ready at `a3cc49bc`.
- Edge Function sample: 100 events; no 5xx responses.
- Auth and Storage samples: no error-severity events.
- Postgres sample: no error-severity event after 2026-07-29 16:25:03 UTC.
  Earlier entries correspond to controlled negative probes and predate the
  reconciled Lovable baseline.
- Database integrity: 247 Auth users, 247 profiles, no missing/orphan
  profile/role rows, 3 orders, 11 payment events, 117 entitlements, 57
  lifetime-credit entries, and 1 package scan.

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
9. Record the final monitoring, support, and rollback owners below.

## Owner confirmation

These roles must be filled by named people before public launch:

- Monitoring owner: **pending confirmation**
- Customer-support owner: **pending confirmation**
- Rollback decision owner: **pending confirmation**
- Technical rollback executor: **pending confirmation**

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
- Any operational owner is unconfirmed.

## Rollback posture

- Frontend: re-enable or retain Coming Soon as the first containment action.
- Checkout: disable new UPayments checkout before touching historical records.
- Edge Functions: redeploy the immediately prior captured reviewed source.
- Database: prefer a corrective forward migration; use the restricted restore
  point only for a catastrophic rollback.
- Customer rights: never delete or rewrite historical payments, entitlements,
  access dates, original currencies, or refund records.

# JojoPrompts V2 Controlled Deployment Manifest

Prepared: 2026-07-29

Production project: `fxkqgjakbyrxkmevkglv`

Lovable project: `766f3370-d38c-42e5-8566-5e4946986dd2`

This is the post-deployment manifest for the approved controlled V2 pass. It
records the exact current frontend head, applied migrations, deployed function
versions, reconciliation evidence, and rollback posture. It does **not**
authorize public launch. `PUBLIC_LAUNCH_LOCK=true`, Coming Soon, and
`noindex,nofollow` remain mandatory until a separate launch approval.

The project owner reconfirmed the controlled-pass approval in the Codex task
on 2026-07-29. That approval does not cover the launch-lock change.

## Release source

- Executable release head: `6f6d1c9060db1a6eb1554ffa0c679d51cefb093e`
  (`fix: enforce absolute production launch lock`).
- Admin accessibility runtime ancestor: `d397c76f`.
- Receipt-resend runtime ancestor: `082505f2`.
- Field-monitoring runtime ancestor: `ee2edd2d`.
- Lovable synchronized `6f6d1c9060db1a6eb1554ffa0c679d51cefb093e`
  at 2026-07-30 19:18:09 UTC and published the locked build at 19:18:33 UTC.
- Canonical gate at the executable release head:
  - TypeScript: passed.
  - Scoped V2/admin lint: passed.
  - Tests: 973 passed, 0 failed.
  - Production build: passed.
- The production routes `/`, `/login`, `/reset-password`, `/admin`, `/signup`,
  `/explore`, `/pricing`, and `/.lovable/oauth/consent` were rechecked after
  sync. Each rendered Coming Soon with `noindex,nofollow` and zero forms,
  inputs, buttons, or links.

## Security review closure

- Formal diff scan ID:
  `95a2265c-60b9-48bd-ab3c-7ae4c02d00dc`.
- Coverage: 85/85 changed files reviewed between the original Lovable
  baseline and the pre-fix V2 release.
- Findings: one medium legacy-role entitlement bypass and one low unpublished
  version-metadata exposure.
- Corrective source: `48978150b042bf33c6e0ae7d5660fccc63768f18`.
- Corrective database payload:
  `20260729163600_close_v2_security_review_findings.sql`.
- Verification: 88/88 focused authorization tests, the complete canonical
  gate, a real PostgreSQL 16 rehearsal, and controlled production role probes.

## Applied database payload

All seven controlled migrations are recorded in production. The table keeps
the local reviewed filename and payload checksum; Supabase assigned production
versions to API-applied migrations as shown.

| Order | Local migration | Production version/name | SHA-256 | Lines | Bytes |
|---:|---|---|---|---:|---:|
| 1 | `20260728152000_admin_receipt_resend_requests.sql` | `20260729154853` / `20260728152000_admin_receipt_resend_requests` | `c8ee2ab9490d96c7464ea21625fa2687b1b85d39f55f83f760b0124658ee770b` | 631 | 23,637 |
| 2 | `20260728185445_secure_versioned_resource_content.sql` | `20260729154917` / `20260728185445_secure_versioned_resource_content` | `7c04d6ef6276c9a6f948f2d91a18f83afa58ab8ac23d8e279ff2527759a92a10` | 1,528 | 44,248 |
| 3 | `20260728214500_fix_active_v2_rpc_schema_drift.sql` | `20260729154938` / `20260728214500_fix_active_v2_rpc_schema_drift` | `a86a6b121bf30357edf75dfc8582815f226e448b3f7323e0d59b9104ec8704a7` | 1,160 | 31,857 |
| 4 | `20260729163600_close_v2_security_review_findings.sql` | `20260729154958` / `20260729163600_close_v2_security_review_findings` | `2e250d3c948be898bdf12b498025a5d598c3f4be87744e486a5e27fae14fb45d` | 182 | 5,422 |
| 5 | `20260729171000_reconcile_missing_auth_profiles.sql` | `20260729163554` / `reconcile_missing_auth_profiles` | `909312ba3342aeaab28ff8b5e30478c4c6c0fe430dfd6fbcaf1e3b3e79c8ee3c` | 146 | 3,312 |
| 6 | `20260729171438_v2_web_vitals_rum.sql` | `20260729172145` / `v2_web_vitals_rum` | `2ac3588f2996b4a3299a831888c133a658ec898ca57b127eab601fae93d2710d` | 177 | 5,565 |
| 7 | `20260729172438_v2_web_vitals_explicit_deny_policy.sql` | `20260729172506` / `v2_web_vitals_explicit_deny_policy` | `c5028ebb72907e906da8a0dd45a45ef6f2f3fdca758808a2342443a560e7f651` | 10 | 392 |

The migrations are forward-only. Prefer a reviewed corrective migration for a
non-destructive defect. Use the restricted pre-deployment restore point only
for a catastrophic rollback.

## Deployed Edge Functions

Current live versions were refreshed from Supabase after the controlled pass:

| Function | `verify_jwt` | Live version | Supabase bundle SHA-256 | Disposition |
|---|---:|---:|---|---|
| `get-all-users` | `true` | 609 | `1c9cf303a31a9e93834d0145b6629cca46d704f0ee485dd50d011a2336e68169` | Hardened source deployed and fetched back |
| `admin-bulk-confirm-users` | `true` | 87 | `1ed4ba7a4abb600c6027a03cec9549ff6b7db0a9c27b78febf58c48d717fb848` | Hardened source deployed and fetched back |
| `enhance-prompt` | `false` | 251 | `f14092906cf529ed8a2afdab239f46a8503f986b55624bea89972a57e1415ee3` | POST/body-auth contract deployed and fetched back |
| `magic-login` | `false` | 197 | `962556820ef57f216877558d76bbfc227855bbc119f7ce9844bce4245da10e23` | Reviewed HTTP 410 retirement stub deployed |
| `v2-web-vitals` | `false` | 2 | `569e5bc5d528776b762fad41478e23891c76e7f68b5d812059b0ff5d8ff8bdba` | Origin-bound identity-free RUM endpoint deployed |

Payment/receipt functions that were not unnecessarily redeployed were fetched
and compared to reviewed local source during activation:

| Function | `verify_jwt` | Live version | Verification |
|---|---:|---:|---|
| `v2-upayments-webhook` | `false` | 52 | Exact reviewed source, including direct REST `Idempotency-Key` |
| `v2-upayments-status` | `false` | 51 | Exact reviewed source, including receipt reconciliation |
| `v2-admin-resend-order-receipt` | `true` | 3 | Exact reviewed admin-only state machine and confirmation contract |

Other checkout, refund, download, upload, and scan targets were contract-probed
without version-only redeployment. Their live versions remain recoverable from
the Supabase function inventory and the restricted deployment backup.

## Reconciled production state

The post-migration and post-activation checks contain no customer-identifying
values:

| Measure | Value |
|---|---:|
| Auth users / profiles | 247 / 247 |
| Missing/orphan profile or role rows | 0 |
| Resources / published resources | 66 / 65 |
| Resource versions / files | 66 / 1 |
| Products | 66 |
| Orders | 3 (1 paid, 2 failed) |
| Paid order value | 900 fils |
| Order items / payment events | 3 / 11 |
| Refunds | 1 failed sandbox refund, 0 processed fils |
| Entitlements / active entitlements | 117 / 117 |
| Lifetime-credit entries / net | 57 / 1,138,170 fils |
| Package scans | 1 clean |
| Receipt resend requests / payloads | 0 / 0 |
| Active or ambiguous receipt resends | 0 |

The receipt confirmation dialog was opened in the synced preview and cancelled;
no email was sent and no resend request or provider payload was created.

## Controlled QA outcome

- Desktop and 390×844 mobile preview checks passed for the receipt action.
- The resend action is enabled only for the eligible paid order.
- The bilingual confirmation dialog explains the immutable recipient/items/
  amount boundary and requires an auditable reason.
- The confirmation was cancelled before submission.
- The tested mobile action is 44px high. The only 1px document-width artifact
  came from the deliberately screen-reader-only skip link, not visible layout.
- Production still renders Coming Soon.
- `ADMIN_RECEIPT_RESEND_ENABLED=true` is now part of the reviewed runtime.
- `PUBLIC_LAUNCH_LOCK=true` remains unchanged.
- The final Admin V2 semantic sweep found and corrected a nested `main`
  landmark plus placeholder-only publisher/commerce controls. At
  `d397c76f`, the rechecked admin routes expose one `main`, no nested `main`,
  named primary controls, and no page-level horizontal overflow.

## Current stability window

The absolute-lock correction is a runtime change and supersedes the elapsed
accessibility window. The conservative restarted window is:

- Start: 2026-07-30 19:20 UTC / 22:20 Asia/Kuwait.
- Earliest close: 2026-07-31 19:20 UTC / 22:20 Asia/Kuwait.
- Baseline: `6f6d1c9060db1a6eb1554ffa0c679d51cefb093e`.

Any further runtime source, migration, Edge Function, payment/scanner
configuration, or launch-lock change restarts the window. Documentation-only
and test-description-only commits do not.

## Rollback references and containment order

1. Keep or restore Coming Soon; do not change the launch lock during
   containment.
2. Disable new UPayments checkout before altering any historical state.
3. Do not revert production to `d397c76f`, which exposed login/admin routing
   while locked. Redeploy `6f6d1c90` or a reviewed static-lock correction.
4. For Edge Functions, redeploy the immediately prior captured reviewed source.
5. For database defects, prefer a corrective forward migration; use the
   restricted restore point only for catastrophic loss.
6. Never delete or rewrite historical transactions, entitlements, access
   dates, original currencies, receipt events, or refund records.

Restricted backup reference:

`/Users/elzeer/Documents/Codex/jojoprompts-v2-release-backup-20260729`

## Remaining stop conditions

Do not authorize public launch if any of the following remains:

- The restarted 24-hour stability window is incomplete.
- A new unexplained 5xx, repeated database error, entitlement drift, or payment
  reconciliation error remains open.
- Dependency/advisor review reveals an unaccepted critical or high risk.
- Required owner/legal acceptance of the bilingual legal and standard-license
  wording is not recorded.
- Monitoring, support, rollback-decision, or rollback-executor ownership is
  unconfirmed.
- Production Coming Soon or `PUBLIC_LAUNCH_LOCK=true` changes before the
  separate public-launch approval.

The final technical accessibility acceptance passed on 2026-07-30 and is
recorded in `docs/V2_ACCESSIBILITY_ACCEPTANCE_2026-07-30.md`.

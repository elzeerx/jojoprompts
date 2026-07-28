# Edge Function Reachability & Retirement Audit — 2026-07-28

Project: JojoPrompts V2 (Supabase `fxkqgjakbyrxkmevkglv`)
Scope: source-only audit of all 68 live Edge Functions. No live deploys,
no migrations, no publish. Companion inventory:
`src/lib/v2/admin/edgeFunctionRetirementInventory.ts`.

## Executive summary

- **Live inventory:** 68 functions.
- **Source directories:** 67 under `supabase/functions/` (excluding `_shared`,
  `shared`). The live-only slug `v2-qa-one-time-package-upload` has no
  repo source; live already returns HTTP 410.
- **Already 410 (source or live):** 10 slugs — `check-email-exists`,
  `paypal-webhook`, `resend-confirmation-email`,
  `send-email-confirmation-reminder`, `send-password-reset`,
  `send-signup-confirmation`, `track-email-engagement`, `validate-signup`,
  `verify-password-reset`, `v2-qa-one-time-package-upload`.
- **Bounded retirement set (recommended `retire_to_410`, not applied):**
  9 slugs, all V1 PayPal / UPayments / obsolete payment cleanup surfaces
  plus `debug-environment`. See §Retirement set.
- **Hardening set:** 8 slugs with active callers but `verify_jwt=false`
  and/or in-code auth that should be tightened.
- **Unknown / investigate:** 10 slugs that have zero direct src callers
  OR reference dead V1 flows (subscriptions/plan reminders) — kept out
  of the retirement set to preserve any latent path.

Rollback principle: any retirement (410 stub) is restored by reverting
the stub commit and redeploying the prior function source. Nothing in
this pass is destructive at the platform level.

## Methodology & limitations

1. Enumerated `supabase/functions/*` and reconciled 1:1 against the
   supplied 68-name live inventory. Diff verified: exactly one
   live-only slug (`v2-qa-one-time-package-upload`, live 410).
2. Grep-scanned all of `src/` and `supabase/functions/` for
   `functions.invoke("<slug>")`, `/functions/v1/<slug>`, and bare slug
   string references. Cross-checked against
   `src/lib/v2/legacyEndpoints.ts` (V1 registry) and the
   `unsafeAuthHelpers.test.ts` fixture.
3. Classified each function by inbound callers + purpose + V2
   replacement.
4. **Limitations:** grep cannot see reflective invocations, provider-side
   callbacks configured out-of-band, or admin bindings not yet audited.
   For that reason every zero-caller function that is not a V1 payment
   surface is marked `unknown_review` / `investigate`, not
   `legacy_unreachable`. Live cron confirms only `daily-security-cleanup`
   → `cleanup_security_data()` runs; no payment cron jobs exist.

## 68-row audit table

Full typed table lives in
`src/lib/v2/admin/edgeFunctionRetirementInventory.ts`. Summary columns:

| Function | verify_jwt | Classification | Disposition |
|---|---|---|---|
| generate-metadata | T | required_v2 | keep |
| suggest-prompt | F | unknown_review | harden |
| get-all-users | T | required_shared_account_auth | keep |
| get-image | F | required_v2 | keep |
| create-subscription | F | unknown_review | investigate |
| cancel-subscription | F | unknown_review | investigate |
| validate-file-upload | F | unknown_review | investigate |
| get-paypal-client-id | F | legacy_unreachable | retire_to_410 |
| process-paypal-payment | F | legacy_unreachable | retire_to_410 |
| verify-paypal-payment | F | legacy_unreachable | retire_to_410 |
| recover-orphaned-payments | F | legacy_unreachable | retire_to_410 |
| paypal-webhook | F | already_410 | keep |
| get-transaction-by-order | F | legacy_unreachable | retire_to_410 |
| delete-my-account | F | required_v2 | harden |
| send-email | F | required_shared_account_auth | keep |
| get-admin-transactions | F | unknown_review | investigate |
| generate-use-case | T | required_v2 | keep |
| resend-confirmation-email | F | already_410 | keep |
| auto-capture-paypal | F | legacy_unreachable | retire_to_410 |
| scheduled-payment-cleanup | F | legacy_unreachable | retire_to_410 |
| debug-environment | F | legacy_unreachable | retire_to_410 |
| resend-confirmation-alternative | T | unknown_review | investigate |
| send-signup-confirmation | F | already_410 | keep |
| track-email-engagement | F | already_410 | keep |
| enhance-prompt | F | required_v2 | harden |
| send-email-confirmation-reminder | F | already_410 | keep |
| send-purchase-confirmation | F | legacy_unreachable | retire_to_410 |
| get-users-without-plans | T | unknown_review | investigate |
| send-bulk-plan-reminders | T | unknown_review | investigate |
| send-plan-reminder | T | unknown_review | investigate |
| generate-magic-link | F | unknown_review | investigate |
| magic-login | F | required_shared_account_auth | harden |
| get-user-insights | F | unknown_review | investigate |
| smart-unsubscribe | F | required_v2 | keep |
| ai-gpt5-metaprompt | F | required_v2 | harden |
| ai-json-spec | F | required_v2 | harden |
| translate-prompt | T | required_v2 | keep |
| translate-text | F | required_v2 | harden |
| auto-generate-prompt | F | unknown_review | investigate |
| validate-signup | F | already_410 | keep |
| admin-users-v2 | T | unknown_review | investigate |
| resend-payment-email | T | required_shared_account_auth | keep |
| admin-bulk-confirm-users | T | required_shared_account_auth | keep |
| check-email-exists | F | already_410 | keep |
| process-upayments-payment | F | legacy_unreachable | retire_to_410 |
| upayments-webhook | F | legacy_unreachable | retire_to_410 |
| send-abandoned-cart-email | T | required_shared_account_auth | keep |
| send-password-reset | F | already_410 | keep |
| verify-password-reset | F | already_410 | keep |
| ai-studio-chat | T | required_v2 | keep |
| ai-studio-image | T | required_v2 | keep |
| mcp | F | required_v2 | harden |
| resource-download | F | required_v2 | keep |
| admin-package-upload | F | unknown_review | investigate |
| v2-upayments-checkout | F | required_v2 | keep |
| v2-upayments-refund | F | required_v2 | keep |
| v2-upayments-status | F | required_v2 | keep |
| v2-upayments-webhook | F | required_v2 | keep |
| submit-contact | F | required_v2 | keep |
| v2-admin-upload-resource-file | T | required_v2 | keep |
| v2-admin-package-scan-control | T | required_v2 | keep |
| v2-package-scan-worker | F | required_v2 | keep |
| v2-qa-one-time-package-upload | F | already_410 | keep |
| v2-admin-payment-settings-status | T | required_v2 | keep |
| v2-admin-email-settings-status | T | required_v2 | keep |
| v2-admin-storage-settings-status | T | required_v2 | keep |
| v2-admin-integrations-settings-status | T | required_v2 | keep |
| v2-admin-roles-settings-status | T | required_v2 | keep |

## Confirmed security findings

1. **`debug-environment` — unauthenticated environment leak.**
   `verify_jwt=false`, zero request authorization, returns runtime /
   config values. No active src caller. Highest-priority retirement.
2. **V1 PayPal surface (8 functions) — obsolete + unauthenticated.**
   `get-paypal-client-id`, `process-paypal-payment`,
   `verify-paypal-payment`, `auto-capture-paypal`,
   `recover-orphaned-payments`, `get-transaction-by-order`,
   `send-purchase-confirmation`, `scheduled-payment-cleanup`. All
   `verify_jwt=false`, no active caller beyond
   `src/lib/v2/legacyEndpoints.ts` registry. V2 uses
   `v2-upayments-*` + inline receipts.
3. **V1 UPayments (`process-upayments-payment`, `upayments-webhook`).**
   Registry-only refs; replaced by `v2-upayments-checkout` /
   `v2-upayments-webhook`.
4. **`get-admin-transactions`.** `verify_jwt=false` with a custom
   `verifyAdmin` guard. Needs a line-by-line review to confirm the
   guard covers every response path (including error branches) before
   trusting production use. Marked `investigate`.
5. **Hardening set with `verify_jwt=false`:** `enhance-prompt`,
   `ai-gpt5-metaprompt`, `ai-json-spec`, `translate-text`, `mcp`,
   `magic-login`, `delete-my-account`, `suggest-prompt`. Each has an
   active caller but should either (a) flip `verify_jwt=true` where
   the caller is authenticated, or (b) verify the in-code bearer /
   captcha / secret check is complete.

## Bounded retirement set (recommended, NOT applied)

Nine slugs meet the strict bar (no active caller beyond registry,
documented V2 replacement or obsolete model, `verify_jwt=false`):

1. `debug-environment`
2. `get-paypal-client-id`
3. `process-paypal-payment`
4. `verify-paypal-payment`
5. `auto-capture-paypal`
6. `recover-orphaned-payments`
7. `get-transaction-by-order`
8. `send-purchase-confirmation`
9. `scheduled-payment-cleanup`
10. `process-upayments-payment`
11. `upayments-webhook`

(That is 11 slugs — the earlier 13-function retirement idea was
imprecise; two of its members are already 410 stubs and are excluded.)

## Hardening set (keep, tighten auth)

`suggest-prompt`, `enhance-prompt`, `ai-gpt5-metaprompt`,
`ai-json-spec`, `translate-text`, `mcp`, `magic-login`,
`delete-my-account`.

## Unknown / review set (do NOT retire without further evidence)

`create-subscription`, `cancel-subscription`, `validate-file-upload`,
`get-admin-transactions`, `resend-confirmation-alternative`,
`get-users-without-plans`, `send-bulk-plan-reminders`,
`send-plan-reminder`, `generate-magic-link`, `get-user-insights`,
`auto-generate-prompt`, `admin-users-v2`, `admin-package-upload`.

For each, confirm one of: (a) the calling hook/component is reachable
from an active V2 route; (b) an out-of-band caller (provider,
scheduled task, admin binding) exists; (c) no caller exists — then
promote to `legacy_unreachable` in the next audit pass.

## Staged retirement order

Stage the retirement in three separate PRs so each is independently
rollback-safe:

1. **Stage 1 — `debug-environment`.** Highest severity, zero blast
   radius. 410 stub, log the redirect.
2. **Stage 2 — V1 PayPal (7 slugs).** Group together: they share
   the retired provider. Announce in `#release` and update
   `RETIRED_LEGACY_EDGE_SLUGS` if needed.
3. **Stage 3 — V1 UPayments (2 slugs) + `scheduled-payment-cleanup` +
   `send-purchase-confirmation`.** Requires prior confirmation that
   the UPayments provider dashboard no longer targets
   `upayments-webhook`.

## Rollback principle

Each retirement is a source-level 410 stub. Rollback = revert the stub
commit and redeploy the prior handler. No data migration is involved;
no Supabase state is touched by the retirement itself.

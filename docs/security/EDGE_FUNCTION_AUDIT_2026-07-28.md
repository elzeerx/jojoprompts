# Edge Function Reachability & Retirement Audit — 2026-07-28

Project: JojoPrompts V2 (Supabase `fxkqgjakbyrxkmevkglv`)
Scope: source-only audit of all 68 live Edge Functions. No live deploys,
no migrations, no publish. Companion inventory:
`src/lib/v2/admin/edgeFunctionRetirementInventory.ts`.

## Executive summary

- **Live inventory:** 68 functions.
- **Source directories:** 67 under `supabase/functions/` (excluding
  `_shared`, `shared`). The live-only slug
  `v2-qa-one-time-package-upload` has no repo source; live already
  returns HTTP 410.
- **Already 410 (source or live) — `already410Live: true`:** 10 slugs —
  `check-email-exists`, `paypal-webhook`, `resend-confirmation-email`,
  `send-email-confirmation-reminder`, `send-password-reset`,
  `send-signup-confirmation`, `track-email-engagement`,
  `validate-signup`, `verify-password-reset`,
  `v2-qa-one-time-package-upload`. These are the pre-existing
  retirement state, NOT unapplied recommendations.
- **Bounded retirement set (recommended `retire_to_410`, NOT applied
  by this audit — `recommendedRetirementAppliedLive: false`):**
  **23 slugs** (11 obsolete payment/debug + 12 resolved from the prior
  investigate set via full route-graph trace). See §Retirement set.
- **Hardening set:** 8 slugs — active callers but `verify_jwt=false`
  and/or in-code auth that should be tightened.
- **Unknown / investigate remaining:** **0**. All 13 previously
  deferred slugs were resolved this pass.
- **Retirement-application semantics:** `recommendedRetirementAppliedLive`
  and `already410Live` are separate fields. The former is always
  `false` in this pass; the latter records the pre-existing 410 state
  of the 10 stub slugs.

Rollback principle: any retirement (410 stub) is restored by reverting
the stub commit and redeploying the prior function source. Nothing in
this pass is destructive at the platform level.

## Methodology & limitations

1. Enumerated `supabase/functions/*` and reconciled 1:1 against the
   supplied 68-name live inventory (one live-only slug:
   `v2-qa-one-time-package-upload`).
2. Grep-scanned `src/` and `supabase/functions/` for
   `functions.invoke("<slug>")`, `/functions/v1/<slug>`, and bare slug
   strings; cross-checked `src/lib/v2/legacyEndpoints.ts` and
   `unsafeAuthHelpers.test.ts`.
3. For every previously-deferred slug, traced the component → parent
   → route-registration chain (`src/pages/admin/layout/adminSectionElements.tsx`,
   `src/config/routes.ts`) to prove reachability rather than infer it
   from filename. Existence under `src/pages/admin/components/...` is
   NOT reachability unless an active `adminSectionElements` key
   imports the parent chain.
4. **Limitations:** grep cannot see reflective invocations,
   provider-side callbacks configured out-of-band in the provider
   dashboard, or admin bindings not yet audited. `daily-security-cleanup`
   → `cleanup_security_data()` is the only active pg_cron job; no
   payment cron jobs exist.

## 68-row audit table

Full typed table lives in
`src/lib/v2/admin/edgeFunctionRetirementInventory.ts`. Summary columns:

| Function | verify_jwt | Auth mechanism | Classification | Disposition |
|---|---|---|---|---|
| generate-metadata | T | platform_jwt | required_v2 | keep |
| suggest-prompt | F | verifyAdmin_shared | unknown_review | harden |
| get-all-users | T | verifyAdmin_shared | required_shared_account_auth | keep |
| get-image | F | published_resource_allowlist | required_v2 | keep |
| create-subscription | F | none | legacy_unreachable | retire_to_410 |
| cancel-subscription | F | verifyAdmin_shared | legacy_unreachable | retire_to_410 |
| validate-file-upload | F | verifyAdmin_shared | legacy_unreachable | retire_to_410 |
| get-paypal-client-id | F | none | legacy_unreachable | retire_to_410 |
| process-paypal-payment | F | none | legacy_unreachable | retire_to_410 |
| verify-paypal-payment | F | none | legacy_unreachable | retire_to_410 |
| recover-orphaned-payments | F | none | legacy_unreachable | retire_to_410 |
| paypal-webhook | F | none | already_410 | keep |
| get-transaction-by-order | F | verifyAdmin_shared | legacy_unreachable | retire_to_410 |
| delete-my-account | F | custom_user_jwt | required_v2 | harden |
| send-email | F | service_secret | required_shared_account_auth | keep |
| get-admin-transactions | F | verifyAdmin_shared | legacy_unreachable | retire_to_410 |
| generate-use-case | T | platform_jwt | required_v2 | keep |
| resend-confirmation-email | F | none | already_410 | keep |
| auto-capture-paypal | F | none | legacy_unreachable | retire_to_410 |
| scheduled-payment-cleanup | F | none | legacy_unreachable | retire_to_410 |
| debug-environment | F | none | legacy_unreachable | retire_to_410 |
| resend-confirmation-alternative | T | platform_jwt | legacy_unreachable | retire_to_410 |
| send-signup-confirmation | F | none | already_410 | keep |
| track-email-engagement | F | none | already_410 | keep |
| enhance-prompt | F | verifyAdmin_shared | required_v2 | harden |
| send-email-confirmation-reminder | F | none | already_410 | keep |
| send-purchase-confirmation | F | none | legacy_unreachable | retire_to_410 |
| get-users-without-plans | T | verifyAdmin_shared | legacy_unreachable | retire_to_410 |
| send-bulk-plan-reminders | T | verifyAdmin_shared | legacy_unreachable | retire_to_410 |
| send-plan-reminder | T | verifyAdmin_shared | legacy_unreachable | retire_to_410 |
| generate-magic-link | F | verifyAdmin_shared | legacy_unreachable | retire_to_410 |
| magic-login | F | captcha_or_rate_limit | required_shared_account_auth | harden |
| get-user-insights | F | verifyAdmin_shared | legacy_unreachable | retire_to_410 |
| smart-unsubscribe | F | captcha_or_rate_limit | required_v2 | keep |
| ai-gpt5-metaprompt | F | platform_jwt | required_v2 | harden |
| ai-json-spec | F | platform_jwt | required_v2 | harden |
| translate-prompt | T | verifyAdmin_shared | required_v2 | keep |
| translate-text | F | verifyAdmin_shared | required_v2 | harden |
| auto-generate-prompt | F | verifyAdmin_shared | legacy_unreachable | retire_to_410 |
| validate-signup | F | none | already_410 | keep |
| admin-users-v2 | T | verifyAdmin_shared | legacy_unreachable | retire_to_410 |
| resend-payment-email | T | verifyAdmin_shared | required_shared_account_auth | keep |
| admin-bulk-confirm-users | T | verifyAdmin_shared | required_shared_account_auth | keep |
| check-email-exists | F | none | already_410 | keep |
| process-upayments-payment | F | none | legacy_unreachable | retire_to_410 |
| upayments-webhook | F | none | legacy_unreachable | retire_to_410 |
| send-abandoned-cart-email | T | verifyAdmin_shared | required_shared_account_auth | keep |
| send-password-reset | F | none | already_410 | keep |
| verify-password-reset | F | none | already_410 | keep |
| ai-studio-chat | T | verifyAdmin_shared | required_v2 | keep |
| ai-studio-image | T | verifyAdmin_shared | required_v2 | keep |
| mcp | F | service_secret | required_v2 | harden |
| resource-download | F | custom_user_jwt | required_v2 | keep |
| admin-package-upload | F | verifyAdmin_shared | required_shared_account_auth | harden |
| v2-upayments-checkout | F | custom_user_jwt | required_v2 | keep |
| v2-upayments-refund | F | verifyAdmin_shared | required_v2 | keep |
| v2-upayments-status | F | custom_user_jwt | required_v2 | keep |
| v2-upayments-webhook | F | provider_status_reconciliation | required_v2 | keep |
| submit-contact | F | captcha_or_rate_limit | required_v2 | keep |
| v2-admin-upload-resource-file | T | verifyAdmin_shared | required_v2 | keep |
| v2-admin-package-scan-control | T | verifyAdmin_shared | required_v2 | keep |
| v2-package-scan-worker | F | service_secret | required_v2 | keep |
| v2-qa-one-time-package-upload | F | none | already_410 | keep |
| v2-admin-payment-settings-status | T | verifyAdmin_shared | required_v2 | keep |
| v2-admin-email-settings-status | T | verifyAdmin_shared | required_v2 | keep |
| v2-admin-storage-settings-status | T | verifyAdmin_shared | required_v2 | keep |
| v2-admin-integrations-settings-status | T | verifyAdmin_shared | required_v2 | keep |
| v2-admin-roles-settings-status | T | verifyAdmin_shared | required_v2 | keep |

## Route-graph resolution of the previously-deferred 13

For each slug we traced component/hook → importing parent → `adminSectionElements`
(or `src/config/routes.ts`) reachability. Not-wired components are
**unreachable** even if the file exists under `src/pages/`.

1. **create-subscription** → `src/hooks/payment/helpers/subscriptionActivator.ts`
   has zero importers in `src/`. V2 has no subscriptions. → **retire_to_410**
2. **cancel-subscription** → `useUserService.ts:406` `cancelUserSubscription`
   is only referenced by `UsersManagement.tsx` (V1) and `UserTableRow.tsx`.
   `adminSectionElements.users` wires `UsersV2`, not `UsersManagement`;
   `UsersV2` does not call `cancelUserSubscription`. → **retire_to_410**
3. **validate-file-upload** → `useSecureFileUpload.ts` only imported by
   `SecureImageUploadField.tsx` (V1 prompts admin). No `adminSectionElements`
   entry wires that component. → **retire_to_410**
4. **get-admin-transactions** → `usePurchaseHistory.ts:70` only used by
   `PurchaseHistoryManagement.tsx`; that page has no
   `adminSectionElements` registration. Live handler calls
   `verifyAdmin(req)` before body processing (guard is fine) — the
   retirement rationale is unreachability, not a guard defect.
   → **retire_to_410**
5. **resend-confirmation-alternative** → zero source references outside
   `supabase/config.toml` and this inventory. Supabase Auth owns
   confirmation flows. → **retire_to_410**
6. **get-users-without-plans** → `useUsersWithoutPlans.ts` only used by
   `MarketingEmailsPanel.tsx`, only rendered by
   `sections/communications/MarketingPage.tsx`. `MarketingPage` is NOT
   in `adminSectionElements`. V2 dropped plan reminders.
   → **retire_to_410**
7. **send-bulk-plan-reminders** → `useMarketingEmails.ts` chain, same
   unreachable `MarketingPage`. → **retire_to_410**
8. **send-plan-reminder** → same chain. → **retire_to_410**
9. **generate-magic-link** → only invoked internally by
   `send-plan-reminder/index.ts:158` and
   `send-bulk-plan-reminders/index.ts:178`. Both callers unreachable.
   `magic-login` reads its own token and does NOT call this function.
   → **retire_to_410**
10. **get-user-insights** → only invoked internally by the two
    plan-reminder functions. → **retire_to_410**
11. **auto-generate-prompt** → no source caller outside test fixtures.
    V2 prompt generation uses `ai-studio-chat` / `ai-json-spec`.
    → **retire_to_410**
12. **admin-users-v2** → zero source callers. `UsersV2` uses
    `useUserService` (which calls `get-all-users`,
    `admin-bulk-confirm-users`, `resend-payment-email`), NOT
    `admin-users-v2`. Slug name suggested intent that was never wired.
    → **retire_to_410**
13. **admin-package-upload** → still imported by
    `sections/publishing/PackageUploader.tsx` (`:133`, `:160`) via
    `ResourcePublisher`, which IS wired into
    `adminSectionElements.publishingNew/Edit/NewVersion`. Active
    importer + reachable route ⇒ do NOT retire yet. → **harden**;
    migrate `PackageUploader` to `v2-admin-upload-resource-file` in a
    later pass, then retire.

## Confirmed security findings

1. **`debug-environment` — unauthenticated environment leak, and a
   source/deploy sync regression.** `verify_jwt=false`, zero request
   auth, returns runtime/config values. Live logs show version **318**
   returned 410, but the currently deployed version **320** is the
   unsafe diagnostic implementation. This proves that a later
   source/deploy sync can resurrect a retired function. Every
   retirement MUST be source-first, then live-deployed, with a
   post-deploy source/hash/state verification.
2. **`recover-orphaned-payments` — CRITICAL confirmed exposure.** Live
   logs in the last 24h show repeated calls. Current handler is
   public, accepts caller-supplied `userId`, uses `service_role`, and
   creates/updates `user_subscriptions`. Even if the traffic is
   QA/legacy client origin, the surface is unauthenticated
   service-role write access to another user's subscription state.
   Top-priority retirement.
3. **V1 PayPal surface (7 additional functions) — obsolete +
   unauthenticated.** `get-paypal-client-id`, `process-paypal-payment`,
   `verify-paypal-payment`, `auto-capture-paypal`,
   `get-transaction-by-order`, `send-purchase-confirmation`,
   `scheduled-payment-cleanup`. All `verify_jwt=false`, no active
   caller beyond `src/lib/v2/legacyEndpoints.ts`.
4. **V1 UPayments (2 functions).** `process-upayments-payment`,
   `upayments-webhook`. Registry-only refs; replaced by
   `v2-upayments-checkout` / `v2-upayments-webhook`.
5. **`get-admin-transactions`.** Live handler calls shared
   `verifyAdmin(req)` before any response/body processing — the guard
   is fine. Retiring solely because no active admin route reaches it.
6. **Hardening set (8 with `verify_jwt=false` or in-code auth):**
   `suggest-prompt`, `enhance-prompt`, `ai-gpt5-metaprompt`,
   `ai-json-spec`, `translate-text`, `mcp`, `magic-login`,
   `delete-my-account`. Each has an active caller but should either
   (a) flip `verify_jwt=true` where the caller is authenticated, or
   (b) verify the in-code bearer/captcha/secret check is complete.
   `admin-package-upload` is an additional harden-then-migrate
   candidate because its V2 replacement exists.

## Auth-mechanism corrections vs prior pass

- `get-image`: not `verifyAdmin_shared`. Public-by-design proxy that
  restricts to a `published_resource_allowlist` of paths and image
  MIME types only.
- `resource-download`, `v2-upayments-checkout`, `v2-upayments-status`:
  not `platform_jwt`. `verify_jwt=false` with in-handler user JWT
  validation → `custom_user_jwt`.
- `v2-upayments-webhook`: does NOT verify a cryptographic provider
  signature. Its guard is `provider_status_reconciliation` — validate
  envelope, resolve local attempt, then server-to-server call to
  UPayments to reconcile status before settlement. Inbound caller is
  the UPayments provider hitting the notification URL emitted by
  `v2-upayments-checkout`, not any UI component.

## Bounded retirement set (recommended, NOT applied) — **23 slugs**

Group A — 11 obsolete payment / debug surfaces:

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

Group B — 12 resolved from the previously-investigate set via full
route-graph trace:

12. `create-subscription`
13. `cancel-subscription`
14. `validate-file-upload`
15. `get-admin-transactions`
16. `resend-confirmation-alternative`
17. `get-users-without-plans`
18. `send-bulk-plan-reminders`
19. `send-plan-reminder`
20. `generate-magic-link`
21. `get-user-insights`
22. `auto-generate-prompt`
23. `admin-users-v2`

Neither the 10 `already410Live` slugs nor `admin-package-upload` are
in this set. Total = 11 + 12 = **23 slugs**.

## Hardening set (keep, tighten auth)

8 slugs: `suggest-prompt`, `enhance-prompt`, `ai-gpt5-metaprompt`,
`ai-json-spec`, `translate-text`, `mcp`, `magic-login`,
`delete-my-account`. Plus `admin-package-upload` as a
harden-then-migrate candidate.

## Unknown / review set

**0 slugs.** All previously-deferred entries resolved.

## Staged retirement order

Stage the retirement as separate source commits/deployments (there is
no PR workflow here) so each is independently rollback-safe. No
release-channel announcement is required or authorized. Each stage
partitions the 23 slugs without overlap:

1. **Stage 1 — `debug-environment` (1 slug).** Highest severity, zero
   blast radius. Ship the 410 stub, redeploy, and post-deploy verify
   both source content and live version so the version 318 → 320
   regression cannot repeat.
2. **Stage 2 — V1 PayPal / obsolete payment support (8 slugs):**
   `get-paypal-client-id`, `process-paypal-payment`,
   `verify-paypal-payment`, `auto-capture-paypal`,
   `recover-orphaned-payments`, `get-transaction-by-order`,
   `send-purchase-confirmation`, `scheduled-payment-cleanup`. Group
   together because they share the retired provider. Update
   `RETIRED_LEGACY_EDGE_SLUGS` if any slug is not already listed.
3. **Stage 3 — V1 UPayments (2 slugs):** `process-upayments-payment`,
   `upayments-webhook`. Require prior confirmation that the UPayments
   provider dashboard no longer targets `upayments-webhook`.
4. **Stage 4 — Route-graph-resolved unreachable functions (12
   slugs):** `create-subscription`, `cancel-subscription`,
   `validate-file-upload`, `get-admin-transactions`,
   `resend-confirmation-alternative`, `get-users-without-plans`,
   `send-bulk-plan-reminders`, `send-plan-reminder`,
   `generate-magic-link`, `get-user-insights`,
   `auto-generate-prompt`, `admin-users-v2`.

## Rollback principle

Each retirement is a source-level 410 stub. Rollback = revert the
stub commit and redeploy the prior handler. No data migration is
involved; no Supabase state is touched by the retirement itself.

## Post-deploy verification requirement

Because `debug-environment` demonstrated that a later commit can
resurrect a retired function's unsafe implementation, every stage
above MUST include, after live deploy:

1. Fetch the deployed function source or hash and confirm it matches
   the intended 410-stub commit.
2. Curl the live endpoint and confirm HTTP 410 with the expected
   Retry-After / body.
3. Re-check inventory (`edgeFunctionRetirementInventory.ts`) to flip
   `already410Live: true` for the newly retired slug in the following
   audit pass.

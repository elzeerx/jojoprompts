# Phase 6C — UPayments Sandbox Integration: Credential Prep

Read-only prep step. No code changes, no publish, no flag flips in this turn. Once secrets are in place, a follow-up plan will implement checkout/webhook/status/refund validation end-to-end against the sandbox.

## Current state (verified from code + secrets)

Edge functions read UPayments config from `supabase/functions/_shared/v2Upayments.ts::loadUpaymentsConfig()`. The exact env vars referenced are:

- `V2_UPAYMENTS_ENABLED` — feature flag (`"true"` to enable). Must stay **unset / not `"true"`** until validation passes.
- `V2_UPAYMENTS_ENVIRONMENT` — must be exactly `sandbox` (or `production`); anything else disables the integration.
- `V2_UPAYMENTS_API_TOKEN` — UPayments API bearer token for the selected environment.
- `V2_PUBLIC_SITE_URL` — return/callback base URL; must match an entry in the in-code `ALLOWED_SITE_URLS` allowlist.

No webhook signing secret is referenced anywhere in the v2 UPayments code (`v2-upayments-webhook` validates by shape + key allowlist, not HMAC). So no signing-secret env var is required by the current implementation.

Secrets currently configured in this project:

| Secret name                | Status                    |
| -------------------------- | ------------------------- |
| `V2_UPAYMENTS_ENABLED`     | **missing** (keep unset)  |
| `V2_UPAYMENTS_ENVIRONMENT` | **missing**               |
| `V2_UPAYMENTS_API_TOKEN`   | **missing**               |
| `V2_PUBLIC_SITE_URL`       | **missing**               |

Note: `UPAYMENTS_API_TOKEN` and `UPAYMENTS_ENVIRONMENT` (no `V2_` prefix) exist from the legacy V1 integration and are **not** read by the V2 edge functions. Do not reuse them — V2 requires the `V2_`-prefixed names above.

## What I need from you (project owner)

Please add the four secrets below in **Project Settings → Secrets** using Lovable's secure Secrets UI. Do **not** paste any of these values into chat, code, or a database row.

1. `V2_UPAYMENTS_ENVIRONMENT` = `sandbox` (literal string; non-secret but required in Secrets so edge functions can read it).
2. `V2_UPAYMENTS_API_TOKEN` = the **sandbox** API bearer token from your UPayments sandbox dashboard.
3. `V2_PUBLIC_SITE_URL` = the exact site origin used for return/callback URLs (must match the code allowlist, e.g. `https://jojoprompts.lovable.app` or `https://jojoprompts.com`). Confirm which one you want the sandbox flow to use before adding.
4. Leave `V2_UPAYMENTS_ENABLED` **unset for now**. I will only ask you to set it to `true` after sandbox checkout, webhook, status, and refund flows have all passed validation.

Also keep in place:

- `PUBLIC_LAUNCH_LOCK = true` in `src/config/siteMode.ts` (unchanged).
- `V2_COMMERCE_ENABLED` disabled (unchanged).

## Non-secret sandbox field checklist to confirm back in chat

Please confirm (text only, no secret values):

- [ ] Which `V2_PUBLIC_SITE_URL` value you want used for sandbox (`https://jojoprompts.lovable.app` or `https://jojoprompts.com` or another already-allowlisted origin).
- [ ] UPayments sandbox merchant / account country (should be Kuwait / KWD for the existing fils logic to apply).
- [ ] Test card(s) UPayments sandbox expects you to use for KNET vs Visa/Mastercard success and failure paths.
- [ ] Callback / return / webhook URLs configured (or to be configured) in the UPayments sandbox dashboard — I will confirm the exact function URLs once secrets are in and we move to implementation.
- [ ] Confirmation that the sandbox account is fresh / disposable, so test orders and refunds are safe.

## What happens next (not executed in this turn)

Once the four secrets above are present and you have confirmed the checklist, I will return with a Phase 6C implementation plan covering: sandbox smoke test of `v2-upayments-checkout`, webhook signature/shape validation dry-run, status + refund round-trip against sandbox, and only then a controlled flip of `V2_UPAYMENTS_ENABLED=true` in a staging-like context — still without publishing and without enabling `V2_COMMERCE_ENABLED`.

## Technical notes

- Files that will drive validation: `supabase/functions/_shared/v2Upayments.ts`, `supabase/functions/v2-upayments-checkout/index.ts`, `.../v2-upayments-webhook/index.ts`, `.../v2-upayments-status/index.ts`, `.../v2-upayments-refund/index.ts`.
- `ALLOWED_SITE_URLS` in `_shared/v2Upayments.ts` is the source of truth for accepted `V2_PUBLIC_SITE_URL` values; if you need a new origin (e.g. a staging domain), tell me and I will add it via a code change before we set the secret.
- No database migration, no RLS change, no launch-lock change in Phase 6C prep.

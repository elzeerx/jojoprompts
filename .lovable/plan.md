
# `send-email` Edge Function — Compatibility Audit (read-only)

## 1. Function under audit

`supabase/functions/send-email/index.ts` — Deno + Resend transport. Registered `verify_jwt = false` in `supabase/config.toml:21`. Accepts arbitrary `{ to, subject, html, text, user_id, email_type, template, data, template_slug, variables }`, checks unsubscribes, renders DB-managed template (`email_templates` by slug) or a legacy in-file `emailConfirmation` template or raw HTML, sends via Resend from `JoJo Prompts <info@jojoprompts.com>`, logs to `email_logs`. Returns HTTP 200 in both success and failure paths with `{ success, message, messageId?, error? }` (failure returns `success:false` still with 200; blocked-unsubscribe returns `success:true, unsubscribed:true`).

**Security shape today:** unauthenticated + arbitrary recipient + arbitrary HTML + arbitrary subject. Anyone with the anon key (published in the SPA) can send mail from `info@jojoprompts.com` to any recipient with any body — an open email primitive. This is what we want to eliminate without breaking live callers.

## 2. Direct callers of `send-email`

### 2.1 Frontend (browser, authenticated OR anonymous)

| # | File:Line | Auth context | Payload sent | Response usage | Template/type | Recipient/subject/HTML? |
|---|---|---|---|---|---|---|
| F1 | `src/utils/emailService.ts:19` (private `sendEmail`) — dispatch for contact confirm, contact admin notify, welcome, password reset, payment confirmation, subscription cancelled, payment failed, account deleted, email confirmation | Browser; sometimes signed-in, sometimes anonymous (contact form) | `{ to, subject, html, text }` — full raw HTML built in-browser from `src/utils/emailTemplates.ts` | Reads `data.success` / `data.error`, retries transient errors | None (raw HTML) | Yes: any `to`, any `subject`, any `html` |
| F2 | `src/pages/ContactPage.tsx:30,38` → F1 (`sendContactConfirmation`, `sendContactAdminNotification`) | **Anonymous** (contact page pre-login) | `{to,subject,html,text}` | Toasts on failure | Fixed EN/AR contact templates in `emailTemplates.ts` | Recipient is form-supplied for user copy; admin copy target is hard-coded `info@jojoprompts.com` |
| F3 | `src/hooks/useWelcomeEmail.ts:13` (via `useAuthInitialization.ts:101`) | Authenticated (right after profile bootstrap) | via F1 | success flag | welcome template | Fixed template, recipient = current user email |
| F4 | `src/hooks/usePaymentEmails.ts:19,41,62` | Authenticated (post-checkout hooks; legacy V1 path) | via F1 | success flag | payment-confirmation / payment-failed / subscription-cancelled templates | Recipient = current user, fixed templates |
| F5 | `src/components/admin/EmailTemplatesManagement.tsx:156` (admin "send test") | Authenticated admin | `{ to: testEmail, template_slug, email_type, variables }` | Toast | `template_slug` from `email_templates` table + arbitrary variables | Arbitrary recipient (admin-only UI), no raw HTML |

Note: `usePostPurchaseEmail.ts` calls `send-email-confirmation-reminder`, **not** `send-email`.

### 2.2 Edge Functions (service-role, server-to-server)

All below run inside another Edge Function using the service-role client — they can equally call the sender inline. Every payload uses `template_slug` or fixed templates; none require caller-supplied HTML except password reset.

| # | Caller | Trigger context | Payload | Auth on caller | Fixed template? |
|---|---|---|---|---|---|
| E1 | `supabase/functions/process-paypal-payment/index.ts:57` | Authenticated user completing PayPal checkout (legacy V1) | `{ to, template_slug:'payment_confirmation', email_type:'payment_confirmation', user_id, variables }` | `verify_jwt` (per config) | Yes |
| E2 | `supabase/functions/verify-paypal-payment/index.ts:50` | Same, verification path | Same as E1 | Same | Yes |
| E3 | `supabase/functions/upayments-webhook/index.ts:228` | **Public webhook (verify_jwt=false)** from UPayments V1 | Same as E1 | Provider webhook | Yes |
| E4 | `supabase/functions/process-upayments-payment/index.ts:97` | Authenticated user in V1 UPayments flow | Same as E1 | Public (verify_jwt=false) | Yes |
| E5 | `supabase/functions/resend-payment-email/index.ts:95` | Admin resends receipt | `template_slug:'payment_confirmation'` + variables | Authenticated admin | Yes |
| E6 | `supabase/functions/send-signup-confirmation/index.ts:91` | Post-signup (public verify_jwt=false; service-role admin client) | `{ to, template:'emailConfirmation', email_type:'email_confirmation', user_id, data:{name,email,confirmationLink} }` | Public | Yes (legacy in-file `emailTemplates.emailConfirmation`) |
| E7 | `supabase/functions/resend-confirmation-email/index.ts:105` | Public resend-confirmation | Same as E6 | Public | Yes |
| E8 | `supabase/functions/send-password-reset/index.ts:142` (raw `fetch` with service-role bearer) | Public reset request | `{ to, subject, email_type:'password_reset', user_id, html: <full raw HTML with reset link> }` | Public | **No — sends raw HTML** |

Not calling `send-email` (already Resend-direct, no changes needed for this audit but listed to avoid regressions): `send-plan-reminder`, `send-bulk-plan-reminders`, `send-abandoned-cart-email`, `send-purchase-confirmation`, `send-welcome-email`, `send-email-confirmation-reminder`, `_shared/v2ReceiptDelivery.ts` (V2 receipt goes to Resend directly).

### 2.3 Database triggers, cron, pg_net, webhooks

- `pg_net` extension is enabled (`supabase/migrations/20251026051010_*.sql`) but **no migration invokes `send-email` via `net.http_post` or any HTTP call**. Grep across `supabase/migrations` for `send-email|pg_net|net.http_post` returns only the `CREATE EXTENSION` line.
- No Supabase cron entries reference `send-email` in the repo.
- Only the `v2_order_receipt_deliveries` outbox trigger exists for emails, and it drives V2 receipts through `v2ReceiptDelivery.ts` (Resend directly), not `send-email`.

### 2.4 Docs/scripts

- `scripts/update-remaining-functions.sh:23`, `.lovable/plan.md`, `PHASE_2_SESSION_*.md` reference the name; no runtime dependency.
- `scripts/standardize-edge-functions.sh` and `scripts/update-logging.sh` — string references only.

## 3. Sibling email functions (overlap map)

| Flow | Owner (should remain) | Currently also/only via `send-email`? |
|---|---|---|
| Signup email confirmation | `send-signup-confirmation` (uses legacy in-file `emailConfirmation` template inside `send-email`) | Yes — E6 |
| Resend confirmation | `resend-confirmation-email` (same template as above) | Yes — E7 |
| Password reset | `send-password-reset` (raw HTML) | Yes — E8 (only caller passing raw HTML server-side) |
| Welcome | `send-welcome-email` (Resend direct) AND `emailService.sendWelcomeEmail` via F3 → `send-email` | Duplicated |
| Payment confirmation (V1 PayPal + UPayments) | Callers E1–E5 + F4 all go through `send-email` `template_slug:'payment_confirmation'` | Yes |
| Payment confirmation (V2 UPayments) | `_shared/v2ReceiptDelivery.ts` (Resend direct) | No — already migrated |
| Abandoned cart | `send-abandoned-cart-email` (Resend direct) | No |
| Plan reminders (single + bulk) | `send-plan-reminder`, `send-bulk-plan-reminders` (Resend direct) | No |
| Post-purchase email reminder | `send-email-confirmation-reminder` (Resend direct) | No |
| Contact form (user + admin copies) | `emailService` (F2 → `send-email` with raw HTML) | Yes |
| Account deleted / subscription cancelled / payment failed | `emailService` (F1 → `send-email` with raw HTML) | Yes |
| Admin "send test" of a template | `EmailTemplatesManagement.tsx` (F5 → `send-email` `template_slug` + arbitrary `to`) | Yes |

## 4. `supabase/config.toml` auth notes

`send-email` is `verify_jwt = false`. Peers likewise public and dependent on it: `send-signup-confirmation`, `resend-confirmation-email`, `send-password-reset`, `process-upayments-payment`, `upayments-webhook`. Peers authenticated: `resend-payment-email`, `send-plan-reminder`, `send-bulk-plan-reminders`. Toggling `verify_jwt = true` on `send-email` alone would immediately break E3, E6, E7, E8 (all public callers using service-role bearer via `fetch` or invoke) and F2 (anonymous contact form). Any hardening plan must therefore refactor callers *before* changing the function's auth surface.

## 5. Recommended migration path (no changes yet)

Goal: eliminate the anonymous arbitrary-recipient/arbitrary-HTML primitive without breaking any live flow. Forward-only, staged.

**Stage A — Neutralize arbitrary HTML input (backwards-compatible, still `verify_jwt=false`).**
1. In `send-email`, reject any request that includes `html` / `subject` / `text` fields unless the caller is service-role (validate `Authorization` bearer equals `SUPABASE_SERVICE_ROLE_KEY`, or verify JWT and require `has_role(admin)`). Non-privileged callers must pass only `template_slug` or a whitelisted `template`.
2. Add a hard allowlist for `template_slug` / `template` values (`payment_confirmation`, `email_confirmation`, `password_reset`, `welcome`, `contact_confirmation`, `contact_admin_notification`, `account_deleted`, `subscription_cancelled`, `payment_failed`).
3. Add per-IP + per-email rate limit for anonymous callers (contact form is the only legitimate anon caller).

**Stage B — Move the two remaining raw-HTML callers to server-owned templates.**
- F1/F2/F3/F4 (`emailService`) → convert to `template_slug` calls; migrate the HTML currently built in the browser into `email_templates` rows (contact confirmation, contact admin notify, welcome, payment confirmation/failed, subscription cancelled, account deleted, email confirmation).
- E8 (`send-password-reset`) → add a `password_reset` row in `email_templates` and switch to `template_slug`; drop the giant HTML string.

**Stage C — Split the anonymous surface.**
- Contact form: replace F2 with a dedicated `submit-contact` edge function (public, rate-limited, server-owns template + admin recipient). Client no longer touches `send-email` at all.
- Welcome/account-lifecycle emails (F3, F4, part of F1) become authenticated invocations of `send-email` using `template_slug`, recipient forced to `auth.uid()`'s email (looked up server-side from `auth.users`), not caller-supplied.

**Stage D — Flip auth.**
- After Stages B and C, set `verify_jwt = true` in `supabase/config.toml` for `send-email`. Public callers (E3, E6, E7, E8) either (a) already run server-to-server with service-role bearer (Supabase honors it and bypasses JWT verify at the platform edge) or (b) get switched to internal invocation via the service-role client (E6/E7/E8 already use `supabaseAdmin.functions.invoke`, which forwards service-role auth). Verify each on staging.
- Optional final: replace the anonymous rate-limit path with `verify_jwt = true` + an admin/service-role guard so the function is strictly service-to-service; the frontend goes through purpose-built anon endpoints only.

**Stage E — Delete the legacy `emailConfirmation` in-file template** once E6/E7 are moved to `template_slug:'email_confirmation'`, and remove the raw-HTML branches from `send-email`.

## 6. Recommended tests (before any change ships)

Add under `supabase/functions/send-email/*_test.ts` and callers' test files.

1. **Contract, current behavior (regression baseline):** invoke with `{to, subject, html}` returns 200/success — must keep passing until Stage C.
2. **Unsubscribe short-circuit:** insert row in `unsubscribed_emails`, call `send-email`, expect `unsubscribed:true` and no Resend call (mock).
3. **`template_slug` render:** insert active row in `email_templates`, call with `template_slug` + `variables`, assert `subject`/`html` interpolation and tracking pixel appended once.
4. **Legacy `template:'emailConfirmation'`:** call E6/E7 payload shape, assert subject/from/headers unchanged (guard for signup regression).
5. **Password reset payload (E8):** post the raw-HTML payload with service-role bearer, assert 200 + `email_logs` row with `email_type='password_reset'`.
6. **Provider failure logging:** mock Resend rejection, expect `email_logs` row with `success=false` and `delivery_status='failed'`, HTTP still 200 (documented current contract).
7. **Frontend integration (Playwright, existing preview):** contact form submission from `ContactPage` produces both confirmation and admin copies; welcome hook fires exactly once on first login; admin "send test" in `EmailTemplatesManagement` returns success toast with a real `email_templates` slug.
8. **After Stage A lands:** anonymous request with `html` field returns 401/403; anonymous `template_slug` from allowlist still succeeds; anonymous `template_slug` outside allowlist rejected.
9. **After Stage D flip:** anon invoke returns 401; service-role invokes from E1–E8 continue to succeed; frontend paths that were rerouted (Stage C) do not touch `send-email` at all (grep + network trace).
10. **Rate-limit test (Stage A):** N+1 anonymous requests with same IP/email within window → last request returns 429.

## 7. Deliverable of this audit

No code, config, flags, secrets, or deploys were modified. Findings above are sufficient to plan and staff Stages A–E as separate, individually reviewable slices.

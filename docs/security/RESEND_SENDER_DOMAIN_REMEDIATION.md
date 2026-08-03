# Resend sending-domain remediation — password recovery email blocker

Status: OPEN (release blocked)
Owner: Nawaf Alsuwaiyed
Created: 2026-08-03

## Blocker

`2026-08-02 13:55:21 UTC` — Supabase Auth password recovery returned HTTP 500.
Resend rejected the message: **`noreply.jojoprompts.com` is not a verified
sending domain**.

Transactional email (order receipts, contact form, `send-email`) is unaffected:
it sends from `JoJo Prompts <info@jojoprompts.com>` on the `jojoprompts.com`
domain via the Resend REST API, not via Auth SMTP.

The failing identity is configured in **Supabase Auth → SMTP settings**, not in
this repository. No source file references `noreply.jojoprompts.com`.

## Verification tooling added in this repo

- `supabase/functions/v2-admin-email-domain-verification/index.ts`
  Admin-only, POST-only, read-only probe. Calls `GET https://api.resend.com/domains`
  and reports the verification status of `jojoprompts.com` (transactional) and
  `noreply.jojoprompts.com` (auth sender). Never returns the API key, key
  fragments, key length, or raw provider bodies. Deployed 2026-08-03.
- `src/lib/v2/admin/emailDomainVerification.ts`
  Pure normalizer plus a fail-closed `recoveryEmailReadiness()` verdict:
  unknown or unchecked state is never reported as ready.
- `src/lib/v2/admin/emailDomainVerification.test.ts` — 12 contract tests.

## Remediation — choose one

### Option A (recommended, fastest): replace the sender

`jojoprompts.com` is already a verified Resend sending domain.

1. Supabase Dashboard → Authentication → Emails → SMTP settings.
2. Set **Sender email** to `noreply@jojoprompts.com` (or `info@jojoprompts.com`)
   and **Sender name** to `JoJo Prompts`.
3. Keep host `smtp.resend.com`, port `465`, username `resend`, password = the
   Resend API key already used by the Edge Functions.
4. Save.

No DNS change is required, because the parent domain is already verified.

### Option B: verify the subdomain

1. Resend Dashboard → Domains → Add domain → `noreply.jojoprompts.com`.
2. Add the generated MX / TXT (SPF) and DKIM `CNAME`/`TXT` records at the DNS
   provider for `jojoprompts.com`.
3. Wait for Resend to report **Verified** (propagation can take up to 72h).
4. Re-run the admin probe and confirm `auth_sender_ready: true`.

## Post-fix acceptance (required before the gate closes)

1. Run `v2-admin-email-domain-verification` as an admin; require
   `recoveryEmailReadiness()` to return `ready: true`, or `reason:
   use_verified_transactional_sender` **after** Option A is applied and the
   Auth sender now sits on the verified domain.
2. Trigger one controlled password-recovery request for an owned test account.
3. Confirm the email is received.
4. Confirm Supabase Auth logs show `200` (no 500) for `/recover` and Resend
   shows a `delivered` event.
5. Record the evidence in `docs/V2_STABILITY_AND_OPERATIONS_2026-07-29.md` and
   only then request public-launch approval. `PUBLIC_LAUNCH_LOCK` stays `true`
   until that retest is clean.

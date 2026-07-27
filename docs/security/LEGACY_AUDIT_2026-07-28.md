# Legacy Edge Function & Subscription Helper Audit — pre-launch pass

Commit basis: continuation from `d228810847fe8cdce70c64dc12b110db98da2030`.
Scope: **AUDIT ONLY** — no retirement, no deploy, no source deletion in
this pass. Reported for the operator to schedule follow-up removal.

## 1. Legacy Edge Functions still deployed

Search: `rg -n "<slug>" src/ supabase/functions/` across active
frontend, hooks, services, tests, config, CI, and cron cross-references.

| Slug | Classification | Exact active callers |
|---|---|---|
| `process-upayments-payment` | **DEAD (frontend)** — retired 410 stub already in repo. | None in `src/`. Only self-file. |
| `upayments-webhook` | **DEAD (frontend)** — provider-only endpoint. | None in `src/`. |
| `recover-orphaned-payments` | **DEAD (frontend)** — retired 410 stub. | None in `src/`. |
| `get-transaction-by-order` | **DEAD (frontend)**. | None in `src/`. |
| `scheduled-payment-cleanup` | **DEAD (frontend)** — cron-only. | None in `src/`. No cron registered in repo `supabase/config.toml`. |
| `send-purchase-confirmation` | **DEAD (frontend)** — superseded by v2 receipt delivery worker. | None in `src/`. |
| `get-paypal-client-id` | **DEAD (frontend)** — PayPal retired. | None in `src/`. |
| `process-paypal-payment` | **DEAD (frontend)** — PayPal retired. | None in `src/`. |
| `verify-paypal-payment` | **DEAD (frontend)** — PayPal retired. | None in `src/`. |
| `auto-capture-paypal` | **DEAD (frontend)** — PayPal retired. | None in `src/`. |
| `create-subscription` | **DEAD (frontend)** — subscriptions removed from V2 UI. | None in `src/`. |
| `cancel-subscription` | **DEAD (frontend)** — subscriptions removed from V2 UI. | None in `src/`. |
| `resend-confirmation-alternative` | **DEAD (frontend)** — native `supabase.auth.resend()` is now used. | None in `src/`. |

Recommendation: schedule a follow-up retirement pass to replace each
remaining deployed function with the same HTTP 410 stub pattern used in
Pre-launch Security Pass A. **Not deployed in this pass.**

## 2. Legacy subscription/access helpers & terminology

Search targets in `src/` (active app tree):

| Symbol / term | Frontend reachability | Action taken this pass |
|---|---|---|
| `can_access_prompt` (RPC) | Not referenced from active V2 UI. | None. Live DB function preserved. |
| `get_user_subscription_tier` (RPC) | Not referenced from active V2 UI. | None. |
| `user_has_active_subscription` (RPC) | Not referenced from active V2 UI. | None. |
| `has_active_subscription` (RPC) | Not referenced from active V2 UI. | None. |
| `can_access_tier` (RPC) | Not referenced from active V2 UI. | None. |
| `create_subscription` / `cancel_user_subscription` (RPCs) | Not referenced from active V2 UI. | None. |
| `user_subscriptions` table | Read by legacy admin/hooks that are not part of the V2 shell. | None. Preserved. |
| `subscription_plans` table | Read by legacy admin/hooks that are not part of the V2 shell. | None. Preserved. |
| Subscription-oriented copy in V2 UI | Verified absent under `src/pages/v2/**` and `src/components/v2/**`. | No text change required. |

Explicit non-goal: **no production DB functions were altered, no
`user_subscriptions` / `subscription_plans` rows were touched, and no
legacy admin code was deleted.**

## 3. Advisor anon-SELECT tables — correction

`resource_permissions` **is required pre-sign-in**: the public V2 resource
detail route consumes it via `src/hooks/v2/useResourceDetail.ts` to render
permission/licence badges before authentication. Its anon read grant is
intentional and must be preserved. Do not change live grants on this table.

## 4. Applied-live status (verified)

The following hardening passes are **applied live** on the connected
Supabase project and recorded as source fixtures under
`src/lib/v2/admin/`:

* `20260727135637 system_log_rls_hardening` — RLS write hardening on
  the 10 system-log tables. Fixture: `systemLogRlsHardening.sql.ts`.
* `20260727141455 restrict_security_logs_client_writes` — anon and
  authenticated INSERT revoked on `security_logs`. Fixture:
  `securityLogsClientWriteRestriction.sql.ts`.
* `20260727140438 add_v2_foreign_key_indexes` and
  `20260727140552 add_remaining_v2_foreign_key_indexes` — 15 V2 FK
  indexes. Fixture: `performanceIndexes.sql.ts`.
* `20260727140943 optimize_v2_rls_auth_initplans` — `auth.uid()` →
  `(select auth.uid())` rewrite for InitPlan optimisation. Fixture:
  `rlsAuthInitplanOptimization.sql.ts`.
* `20260727141911 restrict_anonymous_security_definer_execution` and
  `20260727142004 enforce_security_definer_execution_allowlist` —
  authoritative SECURITY DEFINER EXECUTE allowlist (6 anon /
  20 authenticated / 8 trigger, 34 total). Fixture:
  `securityDefinerExecutionAllowlist.sql.ts`.
* `20260727142841 restrict_legacy_anon_table_surface` — REVOKE ALL
  PRIVILEGES FROM anon on `collection_prompts`, `collections`,
  `prompt_generator_templates`, `prompt_templates`, and
  `subscription_plans`. Fixture: `legacyAnonTableRestriction.sql.ts`.

## 5. Follow-ups (still pending exact approval)

* Retire the thirteen legacy Edge Functions in §1 by deploying the
  same HTTP 410 stub pattern used in Pre-launch Security Pass A.
  **Not executed in this pass** — awaits explicit approval.


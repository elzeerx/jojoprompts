# Legacy SECURITY DEFINER authorization audit — 2026-07-28 (corrected)

Scope: schema `public`. Source-only. **No live migration, Supabase
mutation, function deploy, publish, or Coming Soon change was performed
in this pass.**

Drafted (not applied) migration:

- Canonical filename (owned by the supabase migration tool):
  `supabase/migrations/20260728120000_legacy_security_definer_authorization_hardening.sql`
  — cannot be written directly from this environment.
- Physical draft for reviewer inspection (byte-identical body):
  `docs/security/drafts/20260728120000_legacy_security_definer_authorization_hardening.sql`.
- Source fixture (mirror + tier enumeration):
  `src/lib/v2/admin/legacySecurityDefinerAuthorization.sql.ts`
  (`LEGACY_SECDEF_MIGRATION_SQL`, byte-parity asserted by
  `legacySecurityDefinerAuthorization.test.ts`).

### Correction notes vs. earlier draft

Signatures below are the authoritative live `pg_proc` shapes at draft
time — the caller supplied `has_function_privilege` evidence for
`authenticated` and `service_role`. Earlier draft errors now fixed:

- `calculate_anomaly_score` was `(uuid, jsonb)` → **`(uuid, text, jsonb)`**.
- `confirm_user_email` was `(uuid)` → **`(uuid, boolean)`**.
- `evaluate_compliance_status` was `(text, uuid)` → **`(text, jsonb)`**.
- `execute_response_action` and `trigger_automated_response` were
  included in the revoke set but live pg_proc shows them **already
  service_role-only** (`authenticated=false, service_role=true`) — they
  are now excluded and no statement is emitted for them.
- The prior header claim that the migration used
  `REVOKE ... IF EXISTS` was incorrect. PostgreSQL does not support
  that syntax on function privileges; the migration uses plain
  `REVOKE EXECUTE`. Idempotence comes from `REVOKE` being a no-op on
  an unprivileged role and `GRANT` being a no-op when already granted.

Sources are labeled as **live evidence** (from `pg_proc` /
`has_function_privilege` values supplied by the caller) or **source
inference** (`rg` sweep of this repo). Do not conflate them.


## Method

Exhaustive `rg` sweep of `src/**`, `supabase/functions/**`,
`supabase/migrations/**`, `docs/**`, `scripts/**`, `*.md`, `*.sql`,
`*.ts`, `*.tsx`. Each occurrence classified as one of: **DB-internal
caller**, **live frontend caller** (traced back to `src/App.tsx` /
`src/routes.ts`), **live Edge Function caller** (non-410 stub),
**obsolete/unreachable reference**, **documentation / test-only
reference**.

Live database evidence relied on for signatures and current grants was
provided by the caller from project `fxkqgjakbyrxkmevkglv`.

## Group A · Audit-log functions — REVOKE all browser roles (drafted)

### `public.log_sensitive_data_access(uuid, text, uuid, text[])`
- **Current grants (live):** SECURITY DEFINER; EXECUTE to `authenticated`
  and `service_role` (per migration `20260726164417`).
- **Callers found:** none in `src/**` or `supabase/functions/**`. Only
  documentation (`PHASE_1_SECURITY_FIXES_COMPLETE.md`), the generated
  `src/integrations/supabase/types.ts`, migration files, and the prior
  hardening fixture reference the name.
- **Risk:** function stamps `p_user_id` as `admin_user_id` verbatim.
  Any authenticated browser could forge an admin audit row.
- **Disposition (drafted):** revoke EXECUTE from `PUBLIC`, `anon`,
  `authenticated`; grant to `service_role` only. No body change.

### `public.log_profile_access_attempt(uuid, text, boolean)`
- **Current grants (live):** SECURITY DEFINER; EXECUTE to
  `authenticated` (default `PUBLIC` fan-out).
- **Callers found:** used inside `get_public_profile_safe(uuid)` and
  `get_user_profile_safe(uuid)` in
  `supabase/migrations/20250923091406_*.sql`; both callers are
  SECURITY DEFINER themselves. No frontend or Edge caller.
- **Risk:** browser may submit arbitrary `target/access/granted` audit
  fields even though `auth.uid()` is stamped for the actor.
- **Disposition (drafted):** revoke from all browser roles. The
  DB-internal callers keep working because they execute as function
  owner, not as the invoking browser role.

## Group B · Unreachable legacy helpers — REVOKE all browser roles (drafted)

Every `.rpc(...)` call site below lives in a module with **zero
external importers** in `src/**`. Import-graph check:

```
rg "from.*(incidentResponse|complianceFramework|behavioralAnalytics)" src/
# (no matches outside the modules themselves)
```

| Function (signature)                                     | Only frontend reference                                   | DB-internal caller                                                     |
| -------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| `calculate_anomaly_score(uuid, jsonb)`                   | `src/utils/analytics/behavioralAnalytics.ts:272` (dead)   | none                                                                   |
| `confirm_user_email(uuid)`                               | none                                                      | none                                                                   |
| `evaluate_compliance_status(text, uuid)`                 | `src/utils/compliance/complianceFramework.ts:171,379` (dead) | none                                                                |
| `evaluate_response_conditions(jsonb, jsonb)`             | none                                                      | `trigger_automated_response` body                                      |
| `execute_response_action(jsonb, jsonb)`                  | none                                                      | `trigger_automated_response` body                                      |
| `is_super_admin(uuid)`                                   | none (frontend `.rpc` calls do not exist; only `profiles.is_super_admin` column reads via `src/hooks/useSuperAdmin.ts`) | `handle_new_user()` trigger; `v2_internal_admin_roles_settings_summary()` |
| `trigger_automated_response(text, jsonb)`                | `src/utils/incident/incidentResponse.ts:440` (dead)       | none                                                                   |
| `user_has_any_role(uuid)`                                | none                                                      | none                                                                   |

DB-internal callers execute under the function owner, so revoking
browser roles does not affect them.

**Disposition (drafted):** for each signature, revoke EXECUTE from
`PUBLIC`, `anon`, `authenticated`; grant to `service_role` only.

## Group C · Customer / RLS helpers — INVESTIGATE (no change in this migration)

These are quoted from RLS policy bodies and/or called by Edge Functions
with an explicit `_user_id` (which today equals the JWT subject).

| Function                              | Live authenticated callers                                                                                                  | Why we did NOT change bodies now                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `can_access_prompt(uuid, uuid)`       | Prompts RLS policies                                                                                                        | Rebinding `_user_id` to `auth.uid()` would silently alter RLS evaluation. |
| `can_access_tier(uuid, text)`         | called by `get_user_subscription_tier`                                                                                       | Same as above.                                                            |
| `can_manage_prompts(uuid)`            | Prompt RLS policies; Edge Functions: `validate-file-upload`, `auto-generate-prompt`, `generate-use-case`, `generate-metadata`, `suggest-prompt`, `translate-text`, `translate-prompt` | Widely embedded; body change requires coordinated Edge refactor.          |
| `get_user_subscription_tier(uuid)`    | called by `can_access_tier`; potential customer-tier probes                                                                  | Needs paired analysis of downstream callers.                              |
| `has_role(uuid, app_role)`            | Edge Functions: `_shared/adminAuth.ts`, `_shared/v2Upayments.ts`, `admin-package-upload`, `v2-admin-upload-resource-file`, `v2-admin-package-scan-control`, `send-email` | Anon-allowlisted per `securityDefinerExecutionAllowlist.sql.ts`. Rebinding would break admin verification. |
| `user_has_active_subscription(uuid)`  | none in `src/**` / `supabase/functions/**`                                                                                   | May still be invoked from RLS or dashboard rollups.                       |

**Proposed follow-up guard (for a separate reviewed migration, NOT in
this file):** wrap the body with

```sql
IF auth.uid() IS NOT NULL
   AND _user_id <> auth.uid()
   AND NOT public.has_role(auth.uid(), 'admin')
THEN _user_id := auth.uid();
END IF;
```

which is a no-op for RLS calls (`_user_id = auth.uid()`) and Edge calls
(pass their own JWT sub), but blocks one customer from probing another.

## Explicitly excluded — `admin_delete_user_data(uuid, uuid)`

Already `service_role`-only per live pg_proc. This migration does not
reference it; contract test enforces the absence.

## Rollback

To restore any single function's authenticated exposure after
application:

```sql
GRANT EXECUTE ON FUNCTION public.<fn>(<sig>) TO authenticated;
```

The exact signatures are enumerated in
`LEGACY_SECDEF_TIER1_AUDIT_LOGGERS` and `LEGACY_SECDEF_TIER2_UNREACHABLE`
in `src/lib/v2/admin/legacySecurityDefinerAuthorization.sql.ts`.

## Unknowns / limitations

- We could not directly enumerate `pg_cron` from source; the caller
  provided evidence that only `daily-security-cleanup` runs and no
  automated-response cron is scheduled. Rely on that evidence.
- Tables `automated_responses`, `response_executions`,
  `compliance_controls`, `user_behavior_baselines` are reported empty;
  we did not sample them ourselves.
- `is_super_admin(uuid)` is a function AND a column on `profiles`. The
  frontend references the column, not the function. If a future path
  begins calling the function from an authenticated context, it will
  need `service_role` (edge) instead — restore per Rollback.

## Files added / changed this pass

- `src/lib/v2/admin/legacySecurityDefinerAuthorization.sql.ts` — drafted migration SQL + tiers.
- `src/lib/v2/admin/legacySecurityDefinerAuthorization.test.ts` — contract tests.
- `docs/security/LEGACY_SECURITY_DEFINER_AUDIT_2026-07-28.md` — this document.

## Confirmation

**No live migration was applied. No Supabase objects were mutated. No
Edge Functions were deployed or edited. The site was not published. The
Coming Soon launch lock was not disabled.**

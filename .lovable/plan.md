# Read-only compatibility inspection — cleanup functions

No code was edited. Findings below are direct grep results from the repo at the current commit.

## 1. `public.cleanup_security_data()`

| File | Lines | Classification |
|---|---|---|
| `supabase/migrations/20251026050437_c7a62aa5-f2da-4f11-8d46-841c8e08d64e.sql` | 144–186 | **Migration/function definition.** `SECURITY DEFINER`, `SET search_path='public'`, returns JSONB. Ends with `GRANT EXECUTE ON FUNCTION public.cleanup_security_data TO service_role;` — no grant to `anon` or `authenticated`. |
| `supabase/migrations/20251026051010_d2d86dbf-ef54-4914-b89b-290454312ec4.sql` | 1–20 | **Cron/schedule SQL.** `cron.schedule('daily-security-cleanup', '0 0 * * *', $$ SELECT public.cleanup_security_data(); $$)`. |
| `src/integrations/supabase/types.ts` | 4435 | **Generated type only** (`Args: never; Returns: Json`). Auto-generated from schema; not a caller. |
| `docs/SECURITY_PHASE3_RATE_LIMITING_COMPLIANCE.md` | 97, 194, 216, 337, 474 | **Docs only.** |

No frontend RPC calls (`supabase.rpc('cleanup_security_data', …)`), no Edge Function invocations, no other backend callers found.

## 2. `public.cleanup_unverified_accounts()`

| File | Lines | Classification |
|---|---|---|
| `supabase/migrations/20251012055346_0ba54f8a-1bf9-4e9c-977a-592abdb5446c.sql` | 99–150 | **Migration/function definition.** `SECURITY DEFINER`, `SET search_path=public`, returns INTEGER. **No `GRANT EXECUTE` statement** in this migration — execute privilege is whatever PostgreSQL/Supabase defaults apply (typically `PUBLIC` unless subsequently revoked). |
| `src/integrations/supabase/types.ts` | 4436 | **Generated type only.** |
| `docs/SIGNUP_SECURITY.md` | 102, 217 | **Docs only** (example `SELECT cleanup_unverified_accounts();`). |

No frontend RPC calls, no Edge Function calls, no cron schedule found in the repo for this function.

## Runtime path analysis

- **`cleanup_security_data`** — the only legitimate runtime path is `pg_cron` invoking it as the cron job owner (postgres/service_role). Execute is explicitly granted only to `service_role`; nothing in the customer UI, admin UI, or any Edge Function calls it. No `anon` or `authenticated` EXECUTE is required.
- **`cleanup_unverified_accounts`** — no UI or Edge Function calls it. It is a maintenance function that should run only from `pg_cron`/`service_role`. Its defining migration does **not** contain the recommended `REVOKE ... FROM PUBLIC/anon` and `GRANT EXECUTE ... TO service_role` block; if defaults leave `PUBLIC` execute in place, that would be an unnecessary boundary exposure. (Whether production has already been hardened live is outside this inspection; the source tree does not reflect such a hardening migration.) No `anon` or `authenticated` EXECUTE is required for any current flow.

## Summary

Neither function is called from frontend code, Edge Functions, or any backend service module. All non-definition, non-cron references are documentation or the generated Supabase types file. Backend/`service_role` execution via `pg_cron` is the only legitimate runtime path for both.

No changes were made.

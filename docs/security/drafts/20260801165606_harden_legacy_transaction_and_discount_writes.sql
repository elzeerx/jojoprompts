-- Harden legacy commerce write surfaces: public.transactions and
-- public.discount_code_usage.
--
-- STATUS: ALREADY APPLIED directly to the live Supabase project.
-- Intended migration-history filename:
--   supabase/migrations/20260801165606_harden_legacy_transaction_and_discount_writes.sql
-- The repository's supabase/migrations/ directory is managed by the platform
-- migration tool and cannot be written to without executing SQL, so this
-- reviewed, idempotent SQL is recorded here as documentation only.
-- DO NOT EXECUTE: it is already live.
--
-- Rationale:
--   * "Users can create their own transactions" allowed any authenticated
--     browser session to fabricate arbitrary payment history rows.
--   * "System can insert discount code usage" allowed unaudited redemption
--     rows to be written directly from the client.
-- Both legacy tables are now read-only for `authenticated` and writable only
-- by `service_role` (Edge Functions / server-authoritative RPCs).

-- 1) RLS enabled on both legacy tables.
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_usage ENABLE ROW LEVEL SECURITY;

-- 2) Drop the permissive browser-write policies.
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "System can insert discount code usage" ON public.discount_code_usage;

-- 3) Revoke all table privileges from browser-reachable roles.
REVOKE ALL ON TABLE public.transactions FROM PUBLIC;
REVOKE ALL ON TABLE public.transactions FROM anon;
REVOKE ALL ON TABLE public.transactions FROM authenticated;

REVOKE ALL ON TABLE public.discount_code_usage FROM PUBLIC;
REVOKE ALL ON TABLE public.discount_code_usage FROM anon;
REVOKE ALL ON TABLE public.discount_code_usage FROM authenticated;

-- 4) Re-grant read-only access to authenticated (RLS still scopes rows).
GRANT SELECT ON TABLE public.transactions TO authenticated;
GRANT SELECT ON TABLE public.discount_code_usage TO authenticated;

-- 5) service_role retains full access for server-side commerce paths.
GRANT ALL ON TABLE public.transactions TO service_role;
GRANT ALL ON TABLE public.discount_code_usage TO service_role;

-- 6) The legacy redemption RPC becomes server-only.
REVOKE EXECUTE ON FUNCTION public.record_discount_usage(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_discount_usage(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_discount_usage(uuid, uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_discount_usage(uuid, uuid, uuid) TO service_role;

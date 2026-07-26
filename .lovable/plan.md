
# Read-only compatibility inspection

No code edits, migrations, deploys, or commits proposed. This plan is a findings report only.

## 1. `log_sensitive_data_access`

| Path | Kind | Notes |
|---|---|---|
| `src/integrations/supabase/types.ts:4598` | Generated types only | Function signature entry in `Database["public"]["Functions"]`. |
| `supabase/migrations/20251023080023_…sql:6` | Migration/SQL definition | `CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(...)` — sets `search_path`, inserts into `admin_audit_log`. |
| `supabase/migrations/20251023075852_…sql:32,39` | Migration comment | Notes function already has `search_path` set. |
| `PHASE_1_SECURITY_FIXES_COMPLETE.md` (lines 51, 59, 74, 170) | Docs | Historical notes. |

**No frontend, Edge Function, RPC, or backend caller invokes `log_sensitive_data_access`.** It exists only as a SQL function definition and a generated TS type. Effectively unused by any runtime code path.

## 2. `admin_audit_log`

### Frontend (authenticated Supabase client, `.from('admin_audit_log')`)
| Path | Op | Notes |
|---|---|---|
| `src/utils/security/adminAuthenticator.ts:144` | `insert` | `AdminAuthenticator.auditAdminAction` — client-side audit write. |
| `src/pages/admin/components/users/hooks/useUserActions.ts:272` | `insert` | Client-side write on admin user actions. |
| `src/components/admin/UserActivityTimeline.tsx:75` | `select` | Reads user activity for admin UI. |
| `src/pages/admin/components/users/components/UserActivityLog.tsx:78` | `select` | Reads audit rows for admin user detail. |
| `src/components/admin/DeleteUserDialog.tsx:324` | String literal only | Rendered SQL snippet inside a JSX code block (informational — not an actual query). |
| `src/utils/database/securityEnhancement.ts:35` | String literal | Listed in `SENSITIVE_TABLES` constant. |
| `src/utils/privacy/gdprCompliance.ts:400` | String literal | Listed in a GDPR table array. |
| `src/integrations/supabase/types.ts:235` | Generated types only | Table row typings. |

### Edge Functions (service-role backend)
| Path | Op |
|---|---|
| `supabase/functions/admin-bulk-confirm-users/index.ts:120,149` | `insert` |
| `supabase/functions/get-all-users/index.ts:32` | `insert` |
| `supabase/functions/get-all-users/handlers/deleteUserHandler.ts:98` | `insert` |
| `supabase/functions/resend-payment-email/index.ts:112` | `insert` |
| `supabase/functions/resend-confirmation-alternative/index.ts:166,199` | `insert` |
| `supabase/functions/shared/securityLogger.ts:41` | `insert` |

### Migrations / SQL
Multiple migrations define, alter policies, or delete from `admin_audit_log`:
`20250618041741`, `20250806172758`, `20250806174028`, `20250806181553`, `20250822185549`, `20250910112925`, `20250911093102`, `20251012055346`, `20251012065303`, `20251023075756`, `20251023080023`.

### Docs
`AUDIT_IMPLEMENTATION_COMPLETE.md`, `PHASE_1_SECURITY_FIXES_COMPLETE.md`, `docs/SECURITY_IMPLEMENTATION.md`, `docs/SECURITY_PHASE3_RATE_LIMITING_COMPLIANCE.md` — reference only.

## 3. `is_verified_admin`

### Frontend (authenticated Supabase `supabase.rpc('is_verified_admin', …)`)
| Path | Notes |
|---|---|
| `src/utils/security/secureProfileAccess.ts:74` | `isVerifiedAdmin(actionContext)` helper — used to gate UI decisions. |
| `src/utils/security/secureProfileAccess.ts:119` | `handleSecurityError` — fire-and-forget call inside error-handler side effect. |
| `src/services/supabase/UserService.ts:288` | Pre-check before privileged user operation. |
| `src/services/supabase/UserService.ts:419` | Pre-check before privileged user operation. |
| `src/integrations/supabase/types.ts:4593` | Generated types only. |

### Edge Functions / backend
No Edge Function calls `is_verified_admin` directly (they use `has_role` via `_shared/adminAuth.ts`).

### Migrations / SQL
Function defined in `supabase/migrations/20250910112925_…sql:9`; used inside RLS policies and other SECURITY DEFINER functions in:
`20250910112925`, `20250911093102` (policies on `admin_audit_log`, `security_logs`), `20250923092514`, `20250923092548` (profile RLS policies).

## UI / customer / admin flow dependency on authenticated clients calling `log_sensitive_data_access`

**None.** No frontend component, hook, service, or Edge Function calls `log_sensitive_data_access` from an authenticated Supabase client (or any client). The function is only referenced by:
- its own SQL definition migration, and
- the generated `types.ts` (type surface only).

Any current audit-write behavior from authenticated admin UI goes through direct `.from('admin_audit_log').insert(...)` (see §2 frontend list) — not through `log_sensitive_data_access`. Server-side callers of the function, if any, live inside other SECURITY DEFINER SQL functions in the database (not visible from repo source code beyond the definition itself).

## Summary

- `log_sensitive_data_access`: **unused by runtime code**; SQL-defined + typed only.
- `admin_audit_log`: heavily used by both authenticated admin UI (2 inserts, 2 selects) and Edge Functions (6+ service-role inserts), plus RLS-governed by migrations.
- `is_verified_admin`: used by 4 frontend call sites in profile/user services and by RLS policies; not called from Edge Functions.

No changes performed.


# Phase 6E11 — Overview Downloads & Delivery Failures KPIs

## 1. Current unfinished / duplicated surfaces (audit)

Base: commit `25f83485…`, Admin V2 & public V2.

Genuinely unfinished operational surfaces:
- **`/admin` Overview** (`src/pages/admin/sections/overview/OverviewV2.tsx:130-138`) — two KPI tiles hard-coded to `"Unavailable"`:
  - `Downloads` → `data.downloads = { available:false, reason:"download event stream not wired" }`
  - `Delivery failures` → `data.delivery_failures = { available:false, reason:"email delivery events not wired" }`
  - Both reasons are **stale**: the streams already exist.
    - Downloads: `activity_events` rows with `action = 'download_authorized'` are inserted by `supabase/functions/resource-download/index.ts` on every successful signed-URL issue.
    - Delivery failures: `public.email_logs.success = false` (indexed on `attempted_at`, `success`) is written by the transactional email path.
  - `get_admin_v2_overview(int)` (last redefinition in `20260722215158_…sql:531-682`) still returns the two "not wired" placeholders even though the RPC already reads other event tables in the same period window.

Placeholder-only or deferred (intentionally out of V2.0 scope — do NOT touch this slice):
- `V2ResourceDetailPage` behavior for out-of-scope resource types (locked V2.0 catalog).
- Homepage / marketing polish, PromptsCatalog SEO copy — optional polish, not blockers.

Duplicated / legacy (already flagged in `.lovable/plan.md §3`, unrouted, no user impact) — deferred cleanup, not part of this slice.

No other Admin V2 route currently renders `EmptyRouteState` or an "Unavailable" primary metric. Every settings/trust/publishing/orders/roles surface is now operational after Phase 6E5–6E10.

## 2. Chosen next phase and rationale

**Phase 6E11 — wire the last two Overview KPIs (Downloads & Delivery failures) to existing event streams.**

Why this is the highest-value bounded next slice:
- It closes the *only* remaining "Unavailable" primary metric on the Admin V2 landing page — the surface every admin sees first.
- Both data sources already exist and are already RLS/admin-safe (`activity_events`, `email_logs`); no schema changes, no new tables, no new grants.
- Purely additive to a single SECURITY DEFINER RPC + presentation logic in one KPI array. Zero risk to publishing, commerce, payments, email, secrets, or public V2 routes.
- Respects locked V2.0 scope: Jojo-owned catalog, UPayments, one-time purchases, 30 KWD lifetime, preview-only.

## 3. Implementation contract & safety boundaries

Scope (in):
1. Extend `public.get_admin_v2_overview(p_period_days int)` to return real values for `downloads` and `delivery_failures` **for the same rolling `v_since` window** already used by the RPC.
2. Update `OverviewV2.tsx` to render the two tiles when `available === true`, keep the honest "Unavailable" fallback when `available === false` (e.g. table empty or admin ever removes the source).
3. Add narrow unit tests around a new pure formatter helper for the two tiles.

Scope (out — must not change):
- No new tables, columns, enums, policies, triggers, or grants.
- No new Edge Functions.
- No writes anywhere — RPC stays `SECURITY DEFINER STABLE` (currently `plpgsql`; keep language, add `STABLE` only if already so — do not weaken).
- No behavioural change to any other overview metric (revenue, entitlements, refunds, attention tiles).
- No changes to `resource-download` or email pipelines. Do **not** add new event-logging code paths.
- No publish, no data mutation, no launch/commerce/email/secret flag change.

Safety boundaries:
- **Fail-closed rendering**: if RPC returns malformed shape or `available !== true`, tile falls back to existing "Unavailable" copy with reason string — never invent zeros. This preserves the "no invented zeros" contract explicitly stated in OverviewV2 (`:149`).
- **Admin gate preserved**: RPC continues to `RAISE EXCEPTION 'not_admin'` for non-admin callers before touching any table.
- **Bounded reads**: both new subqueries filter on the existing `v_since` (defaults to 30 days) using existing indexed columns (`activity_events.created_at`, `email_logs.attempted_at`).
- **Distinct semantics**:
  - `downloads.count` = number of `activity_events` rows with `action='download_authorized'` in the window. Also expose `unique_users` (distinct `actor_user_id`) as `hint`.
  - `delivery_failures.count` = `email_logs` rows with `success = false` and `attempted_at >= v_since`. Also expose `attempts` (total in window) as denominator for a `failure_rate` hint.
- **No PII leaked**: RPC returns aggregate counts only, never rows/emails/user IDs.
- **Empty period is still "available"**: `available:true` with `count:0` (once wired) — the "Unavailable" state is reserved for the "not wired" transitional case, and after this migration only appears if the underlying table read fails.

## 4. Expected files/tables/functions touched

Migration (1 new file, additive REPLACE of an existing function):
- New: `supabase/migrations/<timestamp>_v2_overview_wire_downloads_and_delivery.sql`
  - `CREATE OR REPLACE FUNCTION public.get_admin_v2_overview(int)` — same signature, same admin gate, same return keys; only the two placeholder JSON objects are replaced with real aggregates.
  - Re-issue existing `REVOKE ... FROM PUBLIC, anon` and `GRANT EXECUTE ... TO authenticated, service_role` for the recreated function.

Tables read (existing, no writes):
- `public.activity_events` (filter `action = 'download_authorized'`, `created_at >= v_since`)
- `public.email_logs` (filter `success = false`, `attempted_at >= v_since`; plus total for hint)

Frontend:
- `src/pages/admin/sections/overview/OverviewV2.tsx` — replace the two hard-coded "Unavailable" tiles with values sourced from `data.downloads` / `data.delivery_failures`, retaining the existing `unavailable` fallback when `available !== true`.
- New: `src/lib/v2/admin/overviewKpiFormat.ts` — pure formatter (`formatDownloadsTile`, `formatDeliveryFailuresTile`) so unit-testable in isolation.
- New: `src/lib/v2/admin/overviewKpiFormat.test.ts` — Bun tests covering:
  - `available:true` with counts → returns numeric value + hint
  - `available:true` with zeros → returns `"0"` (not "Unavailable")
  - `available:false` → returns unavailable state with reason
  - Missing/malformed field → fails closed to unavailable

No changes to:
- `adminSectionElements.tsx`, `adminNavConfig.ts`, `App.tsx`, routes.
- Any other admin section.
- Edge Functions, secrets, storage buckets.
- Public V2 pages.

## 5. Verification & exit gate

Pre-merge checks (all must pass):
1. `bun test src/` → all suites pass; +4 new tests in `overviewKpiFormat.test.ts`.
2. `bunx tsgo --noEmit` → clean.
3. `bun run build` → succeeds.
4. Migration applied to preview DB; `supabase--linter` returns no new warnings attributable to this migration.
5. Live sanity via `supabase--read_query`:
   - `SELECT public.get_admin_v2_overview(30) -> 'downloads';` shows `available:true` and numeric `count`.
   - Same for `-> 'delivery_failures'`.
   - Non-admin session receives `42501 not_admin` (grants unchanged).
6. Preview `/admin` renders both tiles with real numbers; when a KPI has 0 events in window, tile shows `0` (not "Unavailable"). If either underlying table read is disabled in future, tile gracefully falls back to "Unavailable".

Exit gate:
- No publish. No mutation of any row in `orders`, `entitlements`, `refunds`, `resources`, `resource_versions`, `package_scans`, `payment_events`, `activity_events`, `email_logs`, `user_roles`, `profiles`, or auth tables.
- Report: commit SHA, migration filename, test totals, live RPC values for both new metrics, and confirmation that `available` flipped from `false` → `true` for both.

Deferred (explicitly not in this slice):
- Removing legacy unrouted imports in `adminSectionElements.tsx` (cosmetic-only cleanup).
- Any Overview `attention` tile change.
- Public V2 UX polish.

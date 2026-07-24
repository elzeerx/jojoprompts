
## Audit result — what's still unfinished (excluding creators, subscriptions, publishing the site)

Verified against the current codebase, not the stale `.lovable/plan.md`. Recently shipped slices (Trust Reports, Package Scans incl. Cloudmersive, Versions Registry, secure resource-file ingestion, receipt outbox, hardened email, launch lock) are all wired to real components and RPCs.

Remaining placeholders in `src/pages/admin/layout/adminSectionElements.tsx`:

| Route | State | Launch relevance |
|---|---|---|
| `/admin/publishing/drafts` | `EmptyRouteState` redirect to Catalog filter | Low — Catalog + ResourcePublisher already cover the workflow |
| `/admin/publishing/review` | `EmptyRouteState` redirect to Catalog filter | Low — same |
| `/admin/system/audit` | `AuditLogPage.tsx` is a static preview shell (header comment: "placeholder"), renders zero data even though `public.activity_events` is populated by ~15+ V2 migrations + `resource-download` edge function | **High** — trust/compliance surface, sole aggregator for report transitions, refunds, scans, discounts, downloads, order events |
| `/admin/settings/{payments,email,storage,integrations,roles}` | `EmptyRouteState` | Low — configuration surfaces, not launch-blocking |

### Highest-priority unfinished slice

**Admin → System → Audit Log**, wired to `public.activity_events`. Every V2 slice we just shipped writes to this table (Reports triage in `20260724163004…`, Refunds/Recovery/Discounts/Orders in `20260722213033…`/`20260722214306…`/`20260722215158…`, Downloads in `resource-download/index.ts:161`, Scans in the Cloudmersive worker). All of that traffic is currently invisible to admins. This is the natural completion of the trust/moderation cluster and unblocks incident review.

## Slice scope

### Database — one forward-only migration
- `public.v2_admin_list_activity_events(_actor_types text[] default null, _entity_types text[] default null, _actions text[] default null, _actor_user_id uuid default null, _entity_id uuid default null, _search text default null, _from timestamptz default null, _to timestamptz default null, _limit int default 50, _offset int default 0) returns table(...)`
  - `SECURITY DEFINER`, `SET search_path = ''`, admin-gated via `public.has_role(auth.uid(),'admin')`.
  - Enriches rows with actor email (masked via existing `public._v2_mask_email`) and actor display name from `public.profiles`.
  - Applies `_v2_bounded_limit` (reuse existing helper) capped at ~200; returns a stable ordering `(created_at DESC, id DESC)` with a `total_count` window value for pagination.
- `public.v2_admin_get_activity_event(_id uuid) returns jsonb`
  - Admin-gated, returns full row including raw `metadata` and `ip_address` (already anonymized at write time by existing `anonymize_audit_ip` where applicable).
- Explicit `GRANT EXECUTE … TO authenticated`. No table grants change; existing `activity_events_admin_read` RLS is untouched. No new indexes required — `activity_events_actor_idx`, `activity_events_entity_idx`, and `idx_activity_events_action_created` already cover the filter surface.

### Admin UI — replace `AuditLogPage.tsx`
- Filter bar (mobile-first, 44px targets, wraps at 320–430px): actor type multi-select, entity type multi-select, action multi-select (populated from a small hard-coded allowlist derived from existing writer sites, no schema query), free-text search on `action`/`entity_type`, date range, page size.
- Table columns: timestamp (relative + tooltip), actor (masked email + role badge), actor_type, action, entity (type + short id + link when the entity is a resource/order/report/refund/discount), IP.
- Row → `AuditEventDetailSheet` with pretty-printed `metadata`, copy-to-clipboard for id/entity id, and deep links to `/admin/trust/reports/:id`, `/admin/orders/:id`, `/admin/orders/refunds/:id`, `/admin/publishing/versions?resource=…` where applicable.
- New typed hook `src/hooks/admin/v2/useAdminAuditLog.ts` calling `supabase.rpc(...)` — mirrors `useAdminReports` structure.
- Reuse the same responsive shell as `ReportsPage.tsx` / `VersionsRegistryPage.tsx` (stacked filters on mobile, sticky header desktop). No new UI primitives.

### Explicitly out of scope
- No writes to `activity_events`, no new emitters, no schema changes to the table.
- No CSV export in this slice (add later once filter set is confirmed).
- No changes to `admin_audit_log` — that legacy table stays as-is; V2 uses `activity_events` and this slice does not attempt to merge them.
- No changes to launch lock, secrets, feature flags, commerce, publishing workflow, settings pages, subscriptions, or creator flows.

## Bounded acceptance test

1. **Migration applies cleanly** on a fresh DB; `bunx tsgo --noEmit` and `bun run build` succeed after regenerated `types.ts` is picked up.
2. **RPC gate**: calling `v2_admin_list_activity_events` and `v2_admin_get_activity_event` as a non-admin authenticated user returns a `42501`/permission error; as `service_role` and as an `admin` role returns rows. Covered by Deno unit tests in `supabase/functions/_shared/` style (RPC-only, no HTTP function needed).
3. **Filter semantics** (Deno tests using a seeded temp schema OR SQL-only assertions in the migration's own test script):
   - `_actor_types => ['admin']` returns only rows where `actor_type='admin'`.
   - `_from`/`_to` bounds are inclusive/exclusive as documented and prune correctly.
   - `_search` matches case-insensitively against `action` and `entity_type` only (never against `metadata`, to avoid full-jsonb scans).
   - `_limit` is capped by `_v2_bounded_limit`; `total_count` is stable across pages.
4. **UI smoke** (Playwright, admin session, behind existing launch lock, viewport 390×844 and 1280×800):
   - `/admin/system/audit` renders a non-empty table (seed one `activity_events` row via existing writer, e.g. transition a test report through `v2_admin_update_report_status`).
   - Filter by `action = report.status_changed` narrows to that row; clearing filters restores the full list.
   - Opening the detail sheet shows the raw metadata and a working deep link to the source report.
   - No horizontal scroll at 390px; all interactive targets ≥44px.
5. **Zero-drift invariants**: `entitlements`, `lifetime_credit_entries`, `resource_files`, `package_scans`, `package_scan_items`, `orders`, `refunds` row counts unchanged before/after applying the migration and running the UI smoke (the slice is read-only).
6. **Frontend tests**: `bun test src/` passes, including a new test for `useAdminAuditLog` filter serialization and for the deep-link resolver (`resolveEntityLink(entityType, entityId)`).

## Technical notes
- No new tables, buckets, edge functions, or secrets.
- Reuses `_v2_bounded_limit`, `_v2_mask_email`, `has_role`, and existing indexes.
- Deep-link resolver stays a pure frontend function so the RPC contract remains simple `jsonb`/tabular.
- Follows the same SECURITY DEFINER + locked `search_path` + explicit `GRANT EXECUTE` pattern used by every V2 admin RPC shipped in this project.

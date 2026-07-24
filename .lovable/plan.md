
# V2.0 continuation audit — evidence-backed gaps and next slice

Read-only comparison of the current repo/routes against the locked V2.0 plan. Areas explicitly excluded per instructions (UPayments checkout/status/refund/retry URLs, legacy migration execute/rehearsal, Coming Soon launch lock, V2 receipt outbox, send-email/submit-contact hardening) are treated as done — no regressions observed.

## Inventory of remaining V2.0 gaps

### Launch blockers
None found in the "must-have to open commerce" set. All commerce flow is behind the launch lock and the completed slices cover checkout, status, refund, retry, receipt, and hardened email. Publishing, catalog, explore, detail, cart, library, orders, entitlements, refunds, recovery, discounts, users, audit, security are wired to real components.

### High — user-facing gaps still on placeholders
1. **Admin → Trust → Reports** — `src/pages/admin/layout/adminSectionElements.tsx:134-137` shows an `EmptyRouteState` even though:
   - `public.reports` table + RLS exist (`supabase/migrations/20260722200346_...sql:640-666`).
   - Overview dashboard already surfaces an `open_reports` KPI and links to `/admin/trust/reports` (`src/pages/admin/sections/overview/OverviewV2.tsx:56,84`).
   - Sidebar entry exists (`src/pages/admin/config/adminNavConfig.ts:108`).
   - No admin RPC, no triage UI, no user-facing "Report this resource" affordance in `ResourceDetailPage.tsx`. This is a launch-relevant trust/safety hole.
2. **Admin → Trust → Package Scans** — placeholder at `adminSectionElements.tsx:138-142`. `package_scans` table exists and is surfaced only as a column in the Catalog table; no re-scan control or version drill-down.
3. **Admin → Publishing → Drafts / Review / Versions** — three `EmptyRouteState` cards (`adminSectionElements.tsx:96-109`) redirecting to the Catalog with filters. Editorial workflow (assign reviewer, approve/request-changes, version history board) is not wired.

### Later — non-blocking
4. **Admin → Settings → Payments / Email / Storage / Integrations / Roles** — five placeholders (`adminSectionElements.tsx:147-167`). Roles has a working substitute via People → Users; the others are configuration surfaces not required for launch.
5. **Admin → System → Audit Log** — `src/pages/admin/sections/system/AuditLogPage.tsx:6` header comment marks it "placeholder"; needs a full read after this audit before scoping.
6. **V2 catalog wrapper pages** (`AutomationsPage.tsx`, `BundlesPage.tsx`, `ImageStylesPage.tsx`, `PromptsCatalogPage.tsx`, `SkillsPage.tsx`) are thin re-exports of `ExplorePage` with a locked type — intentional, not a gap.

### Not found
No `TODO/FIXME` in V2 code paths, no mock-data usage, no unsafe direct table access on the customer side, no disabled-but-implemented feature paths, no stale route wiring. Download authorization goes through the `resource-download` Edge Function via `useResourceDownload`.

## Recommended next slice — Admin Trust Reports triage (read-only + status updates) + customer report submission

**Why this one.** It is the highest-ranked gap that (a) is launch-relevant (user-safety and moderation), (b) has all schema already in place, (c) requires no commerce enablement, no launch-lock changes, no provider calls, no email sending, and (d) is independently testable end-to-end because both the writer (authenticated reporter) and the reader (admin) can exercise the flow behind the current launch lock.

**Scope**
- **DB (one forward-only migration)**
  - `v2_admin_list_reports(_status text[] default null, _search text default null, _limit int default 50, _offset int default 0)` — SECURITY DEFINER, admin-gated via `has_role`, returns report rows enriched with resource slug/title and masked reporter email.
  - `v2_admin_update_report_status(_report_id uuid, _next_status v2_report_status, _notes text)` — SECURITY DEFINER, admin-gated, writes `resolver_notes`, `resolved_at`, updates `updated_at`, and logs an `activity_events` row.
  - `v2_submit_resource_report(_resource_id uuid, _category text, _details text)` — SECURITY DEFINER, authenticated-only, validates category against an allowlist, caps `details` length, inserts into `public.reports` with `reporter_user_id = auth.uid()`, and calls the existing atomic rate-limit function under scope `report-submit:user` (e.g. 5/hr) to prevent spam.
  - Locked `search_path = ''` on all three; explicit grants; no changes to existing RLS.
- **Admin UI** — replace the `trustReports` `EmptyRouteState` with a `ReportsPage` component:
  - Status filter (open/in_review/resolved/dismissed), search by resource slug, mobile-responsive table with 44px touch targets.
  - Row detail sheet: resource link, category, details, reporter (masked), status transition buttons with notes textarea, timestamps.
  - Typed `supabase.rpc` calls via a new `useAdminReports` hook.
- **Customer UI** — add a compact "Report this resource" button to `ResourceDetailPage.tsx` that opens a dialog with category select + short details textarea, calls `v2_submit_resource_report`, and shows bilingual success/error toasts. No route change.
- **Verification**
  - Deno unit tests for the three RPCs' input validation and admin-gate.
  - Frontend `tsgo` + `bun run build`.
  - Playwright smoke behind the launch lock (admin session): submit a report as a normal user, see it appear in the admin queue, transition it to resolved, confirm `activity_events` row.

**Explicitly out of scope for this slice**
- No changes to launch lock, secrets, feature flags, or commerce.
- No email notifications on report status changes (would go through the already-hardened `send-email` in a later slice).
- No auto-hide/quarantine of reported resources.
- No changes to Package Scans, Drafts, Review, Versions, Settings, or Audit Log — those become their own slices next.

## Technical notes
- Uses only existing tables (`public.reports`, `public.activity_events`, `public.resources`, `public.profiles`) and the existing atomic limiter added during send-email hardening.
- All RPCs follow the project's SECURITY DEFINER + locked `search_path` + explicit GRANT pattern (see `<user-roles>` and `<public-schema-grants>` conventions).
- No new storage buckets, no new Edge Functions.

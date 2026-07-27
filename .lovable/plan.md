# Admin V2 Phase 2 — Read-Only Status Audit

Scope: compare current source against the V2 Admin scope. No changes proposed beyond the concise remaining-work list at the end. All references verified against `src/App.tsx`, `src/pages/admin/**`, and `src/pages/admin/config/adminNavConfig.ts`.

## 1. Completed & evidenced

Admin shell / chrome
- Dedicated shell mounted outside public layout: `src/App.tsx:106-113` (AdminGuard → AdminLayout, no Header/Footer).
- Layout components: `src/pages/admin/layout/AdminLayout.tsx`, `AdminSidebar.tsx`, `AdminTopBar.tsx`, `AdminCommandPalette.tsx`, `AdminSectionSkeleton.tsx`.
- Navigation config (V2, no subscription terms, no duplicates): `src/pages/admin/config/adminNavConfig.ts:53-124`.

Overview
- `/admin` → `OverviewV2` at `src/pages/admin/sections/overview/OverviewV2.tsx` (275 lines). Includes explicit "Unavailable" fallbacks (line 251) and honest KPI formatting via `src/lib/v2/admin/overviewKpiFormat.ts`.

Catalog (all V2 resource types)
- Routes `/admin/catalog[/skills|/automations|/prompts|/prompt-packs|/image-styles|/bundles]` wired at `src/App.tsx:116-123` via locked-type wrappers in `src/pages/admin/layout/adminSectionElements.tsx:67-73`.
- Implementation: `src/pages/admin/sections/catalog/CatalogPage.tsx` + `CatalogTable.tsx`.

Unified publisher
- `ResourcePublisher` (845 lines) supports `new`, `edit`, `new-version` modes: `src/pages/admin/sections/publishing/ResourcePublisher.tsx`; routes at `src/App.tsx:125-127`.

Publishing queues
- Drafts: `src/pages/admin/sections/publishing/DraftsQueuePage.tsx` (thin wrapper) → `PublishingQueue.tsx`.
- Review: `ReviewQueuePage.tsx` → `PublishingQueue.tsx`. Readiness gate enforced by `src/lib/v2/admin/publishingReadiness.ts` + migration `20260725114722`.
- Versions: `VersionsRegistryPage.tsx` (474 lines) + `VersionDetailSheet.tsx`.
- Imports: `LegacyMigrationPreview.tsx` (898 lines) + JSON importer + AI Studio route.
- Taxonomy: `CategoriesManagement` reused at `/admin/publishing/taxonomy`.

Orders (commerce ops)
- Full set wired at `src/App.tsx:139-144`: `OrdersV2Page`, `PaymentEventsPage`, `EntitlementsPage`, `RefundsPage`, `RecoveryPage`, `DiscountsPage` (all in `src/pages/admin/sections/orders/`). Detail sheets present for orders, refunds, payment events, discounts.

People
- Users: `/admin/users` → `src/pages/admin/components/users/UsersManagement.tsx` with bulk actions, activity log, filters, create dialog.

Communications
- Templates: `/admin/communications/templates` → `EmailTemplatesManagement`.
- Delivery health: `/admin/communications/delivery` → `EmailAnalyticsDashboard`.

Trust & Activity
- Reports: `src/pages/admin/sections/trust/ReportsPage.tsx` + `ReportDetailSheet.tsx`.
- Scans: `src/pages/admin/sections/trust/scans/` (Cloudmersive integration, Phase 6E2).
- Admin activity: `src/pages/admin/sections/system/AuditLogPage.tsx` + `AuditEventDetailSheet.tsx` (Phase 6E3).
- Security events: `SecurityMonitoringDashboard` at `/admin/trust/security-events`.

Settings
- Payments (6E6), Email (6E7), Storage (6E8), Integrations (6E9), Roles (6E10) — all read-only dashboards at `src/pages/admin/sections/settings/*.tsx`, backed by JWT-verified status Edge Functions and strict normalizers under `src/lib/v2/admin/*`.

Legacy cleanup
- Legacy paths redirected to canonical V2 routes: `src/App.tsx:170-183` (`/admin/analytics`, `/admin/prompts`, `/admin/categories`, `/admin/purchases`, `/admin/abandoned-cart`, `/admin/emails*`, `/admin/security`, `/admin/audit`).
- No "subscription" terminology in `adminNavConfig.ts`; language is entitlement/order-based.

Responsive/mobile
- 44px touch targets present across order/entitlement/refund/discount/publishing filters (verified via grep on `min-h-[44px]`).
- Mobile-hardened detail sheets: `PublishingQueueDetailSheet.tsx`, `RefundDetailSheet.tsx`, scan cards (Phase 6E1/6E2 responsive corrections).

## 2. Partially implemented / placeholder

- **Overview "Attention Required"**: `OverviewV2.tsx` renders KPI tiles with "Unavailable" fallbacks, but there is no verified evidence of a dedicated Attention Required panel that aggregates review-queue backlog, refund SLA breaches, failed deliveries, scan failures, and orphaned payments into an actionable list. Needs a UI-level check to confirm whether the current tiles satisfy the scope or a dedicated panel is missing.
- **Communications → Delivery health**: route resolves to legacy `EmailAnalyticsDashboard` (`src/components/admin/EmailAnalyticsDashboard.tsx`), not a purpose-built V2 delivery-health surface. Functional but not clearly redesigned per the V2 scope; verification needed.
- **People → Users**: still the legacy `UsersManagement` component under `src/pages/admin/components/users/`. Works and integrated, but has not been rebuilt as a V2 section. Contains a tab labelled "Activity Log" that duplicates trust-activity concerns — needs review.
- **Publishing → Imports**: `LegacyMigrationPreview` is the landing view; JSON importer and AI Studio are exposed as sub-routes. Whether the migration preview supports full ingest for every V2 resource type (skill / automation / prompt / prompt_pack / image_style / bundle) is not verified.
- **Catalog resource operations**: create/edit paths flow through `ResourcePublisher`, but archive/restore controls are not evidenced from this audit — need to open `CatalogTable.tsx` and `PublishingQueueDetailSheet.tsx` action menus to confirm coverage for every resource type.

## 3. Missing routes / flows (evidence-based)

- No dedicated `/admin/attention` or equivalent Attention Required index route — only inline tiles on `/admin`.
- No `/admin/catalog/*/archived` or archive filter route verified; archive/restore may only be reachable via row actions (unverified).
- No standalone Delivery Health V2 page distinct from the reused `EmailAnalyticsDashboard`.
- No V2-native Users section under `src/pages/admin/sections/people/`.

## 4. Verification still required (not performed in this read-only pass)

- Confirm archive & restore actions exist and are wired for every resource type: skill, automation, prompt, prompt_pack, image_style, bundle (inspect `CatalogTable.tsx` row menu + `admin_transition_resource_lifecycle` allowed transitions).
- Confirm full create → validate → review → publish → update-version → archive → restore → audit loop end-to-end for each of the six resource types (e.g., image_style and bundle publisher forms may differ from prompt/skill).
- Confirm audit log surfaces every lifecycle transition (create/publish/archive/restore/refund/entitlement change/role change) — `AuditLogPage` reads `activity_events`; coverage depends on emitters across Edge Functions.
- Confirm mobile behavior at 390×844 for: `ResourcePublisher` (multi-step form), `OverviewV2` tiles, `UsersManagement` table (legacy component pre-dates the V2 mobile pattern).
- Confirm "Attention Required" scope: is the OverviewV2 tile grid the intended surface, or is a separate panel expected?
- Confirm no residual subscription language in user-facing admin copy (nav is clean; page bodies not fully audited).

## 5. Can Phase 2 be honestly declared complete?

**No — not yet under the stated exit gate.**

The exit gate requires an admin to *create, validate, review, publish, update, archive, restore, and audit every V2 resource type*. Current evidence supports:

- Create / validate / review / publish / update: yes for the resource types the unified publisher handles — verified via `ResourcePublisher` modes and Drafts/Review/Versions queues.
- Audit: yes for events emitted into `activity_events` — verified via `AuditLogPage`, but end-to-end coverage per resource-type lifecycle event is not proven in source.
- **Archive / restore**: not evidenced in this audit for any resource type. No archive queue route, no visible archive/restore controls confirmed. This alone blocks the exit gate.
- **All six resource types**: catalog routes exist for each, but the publisher's per-type field coverage (especially `image_style` and `bundle`) was not verified end-to-end in this pass.

Additionally, the People/Users surface and Delivery Health surface are legacy-reused rather than V2-native, and the Overview "Attention Required" concept is only partially expressed.

## Concise remaining-work list

1. Verify and, if missing, add archive/restore actions + an archived filter/queue for every resource type; ensure lifecycle transitions emit audit events.
2. Confirm `ResourcePublisher` covers all six V2 resource types (skill, automation, prompt, prompt_pack, image_style, bundle) end-to-end; fill gaps.
3. Decide whether Overview's KPI tiles satisfy "Attention Required" or build a dedicated aggregation panel.
4. Rebuild or explicitly ratify the legacy `UsersManagement` and `EmailAnalyticsDashboard` as V2-canonical surfaces (or replace).
5. Run a mobile pass (390×844) over `ResourcePublisher`, `UsersManagement`, `OverviewV2`, and legacy templates/analytics dashboards.
6. Spot-check `activity_events` emission for each lifecycle transition per resource type to prove audit completeness.

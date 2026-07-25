
# Admin V2 audit (commit 7fa6e33d) and next-slice proposal

Scope reviewed: every route in `src/pages/admin/config/adminNavConfig.ts` + `src/App.tsx` `/admin/**` routes, backed by `src/pages/admin/layout/adminSectionElements.tsx`. Read-only; no schema, code, or data changed.

## 1. Fully operational pages (real Supabase data, working primary actions)

| Route | Component | Backing data / RPC |
|---|---|---|
| `/admin` | `sections/overview/OverviewV2.tsx` | `get_admin_v2_overview()` + `useAdminRecoveryCounts` |
| `/admin/catalog[/*]` (7 variants) | `sections/catalog/CatalogPage` → `CatalogTable` | resources table + admin RPCs |
| `/admin/publishing/new`, `/edit`, `/versions/new` | `sections/publishing/ResourcePublisher` | `save_admin_resource_draft`, `admin_finalize_resource_package`, `admin_transition_resource_lifecycle`, `admin_publish_resource` |
| `/admin/publishing/drafts`, `/review` | `PublishingQueue` | `v2_admin_list_resource_versions` + lifecycle RPCs (fail-closed readiness) |
| `/admin/publishing/versions` | `VersionsRegistryPage` + `VersionDetailSheet` | `v2_admin_list_resource_versions`, `v2_admin_get_resource_version_detail`, upload edge fn |
| `/admin/publishing/imports` | `LegacyMigrationPreview` | `v2_admin_migration_preview`, `_rehearsal`, `_verification` |
| `/admin/publishing/imports/json` | `JsonPromptImporter` | prompts insert |
| `/admin/publishing/imports/ai-studio[/:id]` | `AiStudioPage` | `ai_studio_drafts` + edge fns |
| `/admin/publishing/taxonomy` | `CategoriesManagement` | `categories` |
| `/admin/orders` | `OrdersV2Page` + `OrderDetailSheet` | `useAdminOrders/Metrics`, `v2_admin_get_order_detail` |
| `/admin/orders/payment-events` | `PaymentEventsPage` | `v2_admin_list_payment_events` |
| `/admin/orders/entitlements` | `EntitlementsPage` | `v2_admin_list_entitlements` |
| `/admin/orders/refunds` | `RefundsPage` + `CreateRefundDialog` | `v2_admin_list_refunds`, refund RPCs |
| `/admin/orders/recovery` | `RecoveryPage` | `v2_admin_list_recovery` |
| `/admin/orders/discounts` | `DiscountsPage` + editor | `v2_admin_list_discounts`, discount RPCs |
| `/admin/users` | `UsersManagement` | admin user RPCs; includes bulk role change |
| `/admin/communications/templates` | `EmailTemplatesManagement` | `email_templates` CRUD + test-send |
| `/admin/communications/delivery` | `EmailAnalyticsDashboard` | `email_logs`/`email_engagement` |
| `/admin/trust/reports` | `ReportsPage` + `ReportDetailSheet` | `v2_admin_list_reports` |
| `/admin/trust/scans` | `trust/scans/ScansPage` | `v2_admin_list_package_scan_queue`, `v2_admin_get_package_scan_details` |
| `/admin/trust/admin-activity` | `system/AuditLogPage` + detail sheet | `v2_admin_list_activity_events`, `v2_admin_get_activity_event` |
| `/admin/trust/security-events` | `SecurityMonitoringDashboard` | `security_monitoring_events`, `threat_indicators` |

## 2. Shells / placeholders / dead controls

- **`/admin/settings/payments`** — `Empty(...)` in `adminSectionElements.tsx:134`. No UI at all.
- **`/admin/settings/email`** — `Empty(...)` at :138.
- **`/admin/settings/storage`** — `Empty(...)` at :142.
- **`/admin/settings/integrations`** — `Empty(...)` at :146.
- **`/admin/settings/roles`** — `Empty(...)` at :150, redirects users to `/admin/users`. `src/pages/admin/components/roles/RoleManagementDashboard.tsx` exists but is not wired to any route.
- **Overview KPIs** `Downloads` and `Delivery failures` — hard-coded "Unavailable" (OverviewV2.tsx:130–138). Not wired in `get_admin_v2_overview`.
- **`ordersLegacyPurchases`** (`PurchaseHistoryManagement`) is imported in `adminSectionElements.tsx:115` but not routed — dead export. Same for `discountsLegacy`, `abandoned-cart` component, `PromptsManagement` legacy page in `src/pages/admin/PromptsManagement.tsx`.
- **`OverviewV2` legacy header link** `Import` points to `/admin/publishing/imports` (fine), but the "New Resource" and "Reconcile Payments" buttons are the only truly primary actions; no dead primaries here.

## 3. Duplicated controls / V2-model terminology conflicts

- `PurchaseHistoryManagement` (legacy) still uses subscription language ("Plan", monthly gateway split, `payment_gateway === 'paypal'`, `formatKWD(amount_usd)` mixing USD/KWD), which contradicts V2 one-time-payment fils/KWD orders. It is not routed but is still lazy-imported — safe to remove.
- `discountsLegacy` (`DiscountCodesManagement`) coexists with the new `DiscountsPage`. Both target discount codes; the legacy one uses the pre-V2 `discount_codes` table, the new one `v2_discount_codes`. Only the new one is routed, but the import is still live.
- `RecoveryPage` and V1 `abandoned_cart_sequences` overlap: recovery lives under both the new V2 `v2_admin_list_recovery` (routed) and legacy `AbandonedCartDashboard` (imported, not routed).
- Nav label `Recovery` vs Overview attention tile `Recovery queue` — same target, minor label drift.
- `OverviewV2` `Import` button links to `/admin/publishing/imports` which is now dominated by the legacy migration preview UI, not a general "import" surface — mildly misleading label but not a defect.
- No subscription/plan terminology found inside routed V2 sections themselves; the conflict is confined to unrouted legacy modules still bundled via `adminSectionElements`.

## 4. Next bounded slice (recommended)

**Slice: replace all five `/admin/settings/*` placeholder screens with real, read-only-first surfaces, then wire Roles as the one interactive settings page.**

Rationale:
- Settings is the only entire nav group where every route is a static shell — the highest visible operational-completeness gap after publishing/orders/trust were completed.
- Roles is the most impactful single interaction (currently only reachable via a hidden bulk-select action inside Users), removes the "redirect to Users" friction, and does not require schema changes: `user_roles`, `app_role`, `has_role()`, and existing admin user RPCs already support it.
- Payments / Email / Storage / Integrations can be genuine read-only "status" panes surfacing information that already exists (env-configured providers, active email templates count, storage bucket policies from `supabase/STORAGE_BUCKETS.md`, MCP manifest) — no new backend needed, closes the "empty page" friction without inventing capabilities.
- Excludes creator marketplace, subscriptions, and public-site work.

Deliverables (proposed, not yet implemented):
1. `sections/settings/RolesPage.tsx` — list users with any role in `user_roles`, per-user role add/remove using existing `useAdminUsers` mutations (`bulkChangeRole` factored into single-user path). Search + filter by role. 44px targets, mobile-first.
2. `sections/settings/PaymentsStatusPage.tsx` — read-only status of UPayments configuration: flag values from `v2Flags.ts`, presence of required edge-fn secrets (via admin-only edge fn that returns booleans, no values), most recent `v2_provider_status_rate_limit` timestamp.
3. `sections/settings/EmailStatusPage.tsx` — counts from `email_templates` (active/inactive), sender identity constant, recent 24 h delivery totals from `email_logs` (already indexed).
4. `sections/settings/StoragePage.tsx` — render `supabase/STORAGE_BUCKETS.md`-derived static bucket table (public/private, size limits, MIME allowlists) as fact, plus admin-only bucket existence probe.
5. `sections/settings/IntegrationsPage.tsx` — MCP manifest summary from `.lovable/mcp/manifest.json` plus a static "not configured" list.
6. Cleanup pass in `adminSectionElements.tsx`: drop unused lazy imports (`PurchaseHistoryManagement`, `DiscountCodesManagement`, `AbandonedCartDashboard`, legacy `PromptsManagement`) to remove terminology conflicts noted in section 3.

Files touched (if approved):
- New: `src/pages/admin/sections/settings/{RolesPage,PaymentsStatusPage,EmailStatusPage,StoragePage,IntegrationsPage}.tsx`
- Modified: `src/pages/admin/layout/adminSectionElements.tsx`, `src/App.tsx` (already routes `settings/*`), `src/pages/admin/components/roles/RoleManagementDashboard.tsx` (repurpose or delete), possibly `src/hooks/useAdminUsers.ts` for single-user role mutation.
- Data tables / RPCs consumed (all existing): `user_roles`, `profiles`, `has_role`, `email_templates`, `email_logs`, `v2_provider_status_rate_limit`.
- Edge fns (existing or trivially additive read-only): may add one `v2-admin-integration-status` fn for secret-presence booleans, but not required for slice v1 — can render "configured via env" statically.

## 5. Schema impact

**None required.** All five pages can be delivered with existing tables and RPCs. The optional secret-presence edge function would only need `SUPABASE_SERVICE_ROLE_KEY` (already available) and does not add tables/columns/policies.


# Admin Dashboard Revamp — Phased Plan

A full restructure of `/admin` from a flat 10-tab layout to a grouped, URL-routed, sidebar-based workspace. Rolled out in 4 phases so the production site never breaks.

## New Information Architecture

```text
/admin
├── Insights
│   ├── Overview              (/admin)
│   ├── Analytics             (/admin/analytics)        [new — extracted from Overview]
│   └── Security              (/admin/security)
├── Content
│   ├── Prompts               (/admin/prompts)
│   ├── Categories            (/admin/categories)
│   └── JSON Prompt Importer  (/admin/prompts/import)   [new feature]
├── Commerce
│   ├── Purchases             (/admin/purchases)
│   ├── Discounts             (/admin/discounts)
│   └── Abandoned Cart        (/admin/abandoned-cart)
├── People
│   └── Users                 (/admin/users)
├── Communications
│   ├── Templates             (/admin/emails/templates)
│   ├── Analytics             (/admin/emails/analytics)
│   └── Marketing             (/admin/emails/marketing) [new — surfaces the "users without plans" panel]
└── System
    └── Audit Log             (/admin/audit)            [stub for future]
```

---

## Phase 1 — Navigation Shell & Routing (no functional changes)

Goal: replace the top tabs with a sidebar and move every section to a real URL. Inner pages stay untouched.

**Build:**
1. Create `src/pages/admin/layout/AdminLayout.tsx` using shadcn `SidebarProvider` + `Sidebar` (collapsible icon mode).
2. Create `src/pages/admin/layout/AdminSidebar.tsx` with the 6 grouped sections above. Active state via `NavLink`. Mini-collapse shows icons only.
3. Add a top bar inside the layout: `SidebarTrigger` + breadcrumb + section title + slot for primary action.
4. Convert `AdminDashboard.tsx` from internal `<Tabs>` to nested routes in `src/App.tsx`:
   - `/admin` → `<AdminLayout>` with `<Outlet/>`
   - Child routes for each section pointing to the existing components (`UsersManagement`, `PromptsManagement`, etc.) — zero changes to those components in this phase.
5. Delete `useAdminTabs`, `MobileTabsList`, `DesktopTabsList`, `adminTabsConfig` once routes work. Keep mobile responsive: sidebar becomes off-canvas drawer below `md`.
6. Add `redirect` from old in-app tab params (if any bookmarks exist) → new URLs.

**Result:** identical functionality, cleaner navigation, deep-linkable URLs, back button works.

---

## Phase 2 — Consolidate Communications & Polish Insights

Goal: collapse the two email tabs into one section with sub-nav, and split Overview vs Analytics.

**Build:**
1. New `src/pages/admin/sections/communications/CommunicationsLayout.tsx` — sub-tabs (Templates / Analytics / Marketing) under `/admin/emails/*`.
2. Move `MarketingEmailsPanel` (currently inside Users tab) into `/admin/emails/marketing` as a first-class page. Keep the hook (`useUsersWithoutPlans`) and edge function unchanged.
3. Split `DashboardOverview` into:
   - **Overview** — KPI cards + Quick Actions + Top prompts (lightweight landing).
   - **Analytics** — charts (revenue trend, signups), category distribution, activity timeline (deeper drill-down).
4. Add a global **Command Palette (⌘K)** using shadcn `Command`: jump to any admin section, search users by email, jump to prompts.

---

## Phase 3 — JSON Prompt Importer (new feature)

Goal: ship the JSON import + convert tool you requested.

**Scope:**
- New route `/admin/prompts/import` with two-pane UI:
  - **Left pane:** JSON input (paste or upload `.json`), schema validation, sample templates.
  - **Right pane:** live preview rendered two ways — (a) human-readable formatted prompt, (b) raw JSON with syntax highlighting and copy button.
- Actions: **Copy formatted**, **Copy JSON**, **Download `.json`**, **Download `.txt`**, **Save as Prompt** (creates a row in `prompts` with the JSON stored in metadata and the readable version as the prompt body).
- Bulk mode: paste an array of JSON prompts → table preview → batch-save selected rows.
- Style picker: choose target LLM (ChatGPT / Claude / Midjourney / Gemini) — formatter adapts output (e.g. Midjourney flattens to single-line with `--` flags; ChatGPT renders as structured markdown).

**Technical:**
- Zod schema for accepted JSON shape (title, description, content/messages, tags, category, target_model, parameters).
- New util `src/lib/formatters/jsonPromptFormatter.ts` with one formatter per target LLM.
- Reuse existing `PromptService` for saves.
- No new tables — uses existing `prompts` table + metadata jsonb column.

---

## Phase 4 — UX Polish & Future-Proofing

1. Persistent sidebar state in `localStorage` (collapsed/expanded).
2. Per-section sticky page headers with contextual filters & primary action button.
3. Empty states + skeleton loaders standardized across all sections.
4. Stub `/admin/audit` page for future audit log feature.
5. Permission gating per route via `<ProtectedRoute requiredRole="admin">` wrappers around the layout.
6. Mobile: confirm off-canvas sidebar works, all sections render correctly at 375px.

---

## Files Changed Summary (Phase 1 only — other phases scoped when we reach them)

**New:**
- `src/pages/admin/layout/AdminLayout.tsx`
- `src/pages/admin/layout/AdminSidebar.tsx`
- `src/pages/admin/layout/AdminTopBar.tsx`
- `src/pages/admin/config/adminNavConfig.ts` (grouped nav structure)

**Modified:**
- `src/App.tsx` — nested admin routes
- `src/pages/admin/AdminDashboard.tsx` — becomes the Overview page only

**Removed (after routes verified):**
- `src/pages/admin/hooks/useAdminTabs.ts`
- `src/pages/admin/components/navigation/MobileTabsList.tsx`
- `src/pages/admin/components/navigation/DesktopTabsList.tsx`
- `src/pages/admin/config/adminTabsConfig.ts`

---

## Safety

- Every phase is independently shippable — no half-broken states.
- Phase 1 touches zero business logic; if anything breaks it's pure navigation.
- All existing edge functions, hooks, and inner components stay intact across all phases.
- No database changes in Phases 1–2. Phase 3 only adds rows to existing `prompts` table.

---

**Approve to start Phase 1.** I'll confirm Phase 1 works end-to-end before proposing Phase 2 details.

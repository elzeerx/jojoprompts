# JojoPrompts V2.0 Requirements Coverage

Last audited: 2026-07-29

This is the completion ledger for the locked V2.0 plan. A source implementation
is not treated as released until its database, function, and rendered-preview
evidence also passes.

## Status meanings

- **Proven locally** — authoritative source plus automated contract/build
  evidence exists in the current local branch.
- **Proven in production data** — confirmed with a read-only query against
  Supabase project `fxkqgjakbyrxkmevkglv`.
- **Pending controlled deployment** — reviewed local work exists but has not
  been synced/applied/deployed.
- **Pending rendered QA** — cannot be proven by source tests; must be exercised
  in the synced Lovable preview.
- **Deferred by scope** — intentionally excluded from V2.0.

## Current release boundary

| Gate | Status | Evidence |
|---|---|---|
| Public launch lock | Proven locally | `src/config/siteMode.ts`; `PUBLIC_LAUNCH_LOCK=true` |
| Local frontend commit on Lovable | Proven at controlled head | Lovable reports `797fc7cf` ready |
| Database schema | Proven after controlled deployment | Five release/reconciliation migrations applied and totals reconciled |
| Edge Function bundle | Proven after controlled deployment | Four changed functions fetched back; unchanged V2 targets contract-probed |
| Admin/customer rendered behavior | Proven against locked preview | Desktop/mobile English/Arabic route sweeps plus post-performance Explore smoke |
| Public release | Not authorized | Coming Soon remains enabled; unlock requires separate approval |

## 1. Locked scope and commercial model

| Requirement | Status | Evidence |
|---|---|---|
| Jojo-owned skills, automations, prompts, image styles, and bundles | Proven locally and in production data | `src/config/v2Flags.ts`; `resources.type`; production contains only Jojo/admin ownership |
| No subscriptions or recurring checkout | Proven locally | `src/config/routes.ts`; V2 pages and functions use orders/entitlements; legacy payment endpoints are retired/read-only |
| Public browsing; sign-in for acquisition, purchase, download, and library | Proven locally | `src/config/routes.ts`; `LibraryPage.tsx`; `V2CheckoutPage.tsx`; `useFreeAcquisition.ts`; `resource-download/index.ts` |
| KWD authoritative; values stored in fils | Proven locally and in production data | `src/config/v2Pricing.ts`; product/order schema; all active V2 product rows are KWD |
| Full Library Lifetime at 30,000 fils | Proven locally and in production data | `LIFETIME_THRESHOLD_FILS`; active SKU `JOJO-FULL-LIBRARY-LIFETIME` is 30,000 fils |
| Individual and cart purchases | Proven locally | `CartPage.tsx`; `V2CheckoutPage.tsx`; `v2_create_order`; UPayments functions |
| No purchase of already-owned resources | Proven locally | authoritative cart/order RPCs; `CartSanitizer.tsx`; library/commerce contract tests |
| Free acquisitions create permanent entitlements | Proven locally | `grant_free_acquisition`; `useFreeAcquisition.ts`; acquisition contracts |
| Individual purchase update rights are version-aware | Proven locally; runtime pending | `resource_versions`, `version_major`, `authorize_resource_download`; secure-version contracts |
| Lifetime includes current/future Jojo-owned resources only | Proven locally | library-scope entitlement checks; public copy and legal/FAQ contracts |
| Creators, commissions, KYC, and payouts excluded | Proven in production data | no creator/commission/payout/KYC/earnings tables; resource writes remain admin-only |
| Future-compatible `owner_id` without creator access | Proven locally and in production data | `resources.owner_id`; the one non-null production owner has an admin role |

## 2. Pricing and lifetime credit

| Requirement | Status | Evidence |
|---|---|---|
| Locked suggested price table | Proven locally | `src/config/v2Pricing.ts`; publisher `TYPE_PRICE_HINT` and defaults |
| Admin-editable authoritative prices | Proven locally; runtime pending | `ResourcePublisher.tsx`; server draft/order RPCs |
| Eligible settled purchases add actual paid value | Proven locally | settlement allocation and `lifetime_credit_entries` migrations |
| Remaining lifetime balance shown | Proven locally | `LifetimeProgress.tsx`; `LifetimeUpgradeCard.tsx`; account/library/detail surfaces |
| Threshold crossing auto-grants lifetime | Proven locally | settlement RPC locks and `lifetime_threshold` entitlement creation |
| Direct lifetime checkout grants same library scope | Proven locally | order/settlement functions and entitlement contracts |
| Discounts count actual paid value | Proven locally | server-authoritative order totals and credit allocation |
| Refunds reverse credit and threshold-derived lifetime | Proven locally; runtime refund QA pending | refund RPCs, allocation ceilings, entitlement revocation, recovery/reconciliation UI |
| Individually owned items remain unless refunded | Proven locally | order-item entitlement provenance and refund-item allocation |
| Grant reason provenance | Proven locally | `v2_grant_reason` and entitlement schemas/RPCs |

## 3. Public information architecture and discovery

| Requirement | Status | Evidence |
|---|---|---|
| Home, Explore, Skills, Automations, Prompts, Image Styles, Bundles | Proven locally | `src/config/routes.ts`; category page components |
| How It Works, Pricing, My Library, Account | Proven locally | route registry and public shell |
| Public resource details | Proven locally | `/resources/:slug`; `ResourceDetailPage.tsx` |
| Search, filter, sort, pagination/load-more | Proven locally | `ExploreFiltersBar.tsx`; `useInfiniteExploreResources.ts`; URL state |
| Desktop sticky filters | Proven locally | sticky responsive filter bar |
| Mobile filter bottom sheet | Proven locally; rendered QA pending | mobile Drawer implementation |
| Preserved scroll position and quick preview | Proven locally; rendered QA pending | `scrollCache`; `QuickPreviewSheet.tsx` |
| Structured skill/automation cards | Proven locally | `SkillResourceCard.tsx` |
| Two-column mobile masonry for visual resources | Proven locally and rendered | `ExploreCatalogContent.tsx`; `VisualResourceCard.tsx`; masonry contract and 390x844 QA |
| No hover-only controls | Proven locally; rendered QA pending | mobile-visible actions and focus-visible paths |
| 44px minimum touch targets | Proven locally; rendered QA pending | V2 component classes and touch-target contracts |
| Arabic RTL content/control order | Proven locally; rendered QA pending | language-aware `dir`; RTL fields; bilingual publisher/detail contracts |
| Canonical URLs, metadata, structured data, share previews | Proven locally; rendered QA pending | `SeoHead.tsx` and SEO contracts |
| Legacy prompt URL compatibility | Proven locally; rendered QA pending | redirects in `App.tsx` and public-shell contracts |

## 4. Resource cards and details

| Requirement | Status | Evidence |
|---|---|---|
| Title, outcome, type, platforms, effort | Proven locally | skill/visual cards and explore result shape |
| Version, update date, trust state | Proven locally | card metadata helpers/contracts |
| Free, price, Owned, Included with Lifetime | Proven locally | ownership label precedence and card contracts |
| View/Get/Add-to-cart actions | Proven locally; rendered interaction pending | card buttons and acquisition/cart hooks |
| Skill overview, examples, limitations, uninstall, support, updates | Proven locally | detail page plus newly exposed bilingual publisher fields |
| Platform-specific installation | Proven locally | installation guide schema, bilingual editor, and localized renderer |
| Files, size, checksum, version | Proven locally; authorized runtime pending | detail downloads and signed-download service |
| Permissions, dependencies, services, secrets | Proven locally | permission kinds and bilingual detail/editor |
| License terms and update rights | Proven locally | license schema, bilingual editor, detail copy |
| Individual and lifetime alternatives | Proven locally | resource detail purchase/lifetime cards |

## 5. My Library and delivery

| Requirement | Status | Evidence |
|---|---|---|
| Permanent owned-resource library | Proven locally; role QA pending | `LibraryPage.tsx`; library RPC/contracts |
| Lifetime-included resources | Proven locally | library-scope entitlement resolution |
| Versions, files, receipts, licenses, guides, updates | Proven locally; runtime QA pending | library/order/detail surfaces |
| Private package storage | Proven in production data | `resource-packages` bucket is private with 25 MiB limit |
| Entitlement-checked signed URLs | Proven locally; deployed runtime pending | `resource-download/index.ts`; 60-second signed URL; authorization RPC |
| Unauthorized/expired/refunded/revoked/version-mismatched denial | Proven locally; runtime negative probes pending | authorization SQL and secure-version tests |
| Published files/versions are immutable | Proven locally; runtime pending | version content migration and publisher/package contracts |

## 6. Admin V2 structure and friction removal

| Requirement | Status | Evidence |
|---|---|---|
| Dedicated admin shell without public chrome | Proven locally; rendered QA pending | `/admin` nested shell in `App.tsx` |
| Target navigation groups/routes | Proven locally | `adminNavConfig.ts`; `adminSectionElements.tsx` |
| Attention Required queues | Proven locally; runtime data pending | `OverviewV2.tsx`; metrics RPC |
| Server-defined KWD metrics and periods | Proven locally; runtime data pending | overview metrics SQL/UI/contracts |
| Operations table, filters, saved views, pagination | Proven locally; rendered QA pending | `CatalogTable.tsx` |
| Bulk lifecycle actions and optional card view | Proven locally; rendered QA pending | catalog lifecycle helpers and table/card modes |
| Unified eight-stage resource publisher | Proven locally; rendered QA pending | `ResourcePublisher.tsx` |
| Bilingual metadata and delivery fields | Proven locally | publisher round-trips Arabic changelogs, platform notes, guides, permissions, licenses, products, and public detail copy |
| AI Studio and JSON importer handoff | Proven locally; rendered QA pending | import routes and contract tests |
| Untouched AI Studio sessions do not persist resources | Proven locally | deferred draft/resource creation contracts |
| Draft, review, publish, version, archive, restore, activity | Proven locally; end-to-end QA pending | lifecycle RPCs, queues, catalog, versions, audit routes |
| No active subscription/plan controls | Proven locally | V2 admin route registry; Users/Communications/Taxonomy contracts |
| No active permanent category/user/resource deletion | Proven locally | Users V2, taxonomy deactivation, catalog archive/restore |
| AI Studio drafts are archive/restore, not hard delete | Proven locally | `DraftsSidebar.tsx` and AI Studio contract |
| No primary admin Favorites/Add Prompt/duplicate communications | Proven locally | route/nav registry and active-section contracts |
| No placeholder primary admin pages | Proven locally | every registered admin route maps to a concrete V2 section |

## 7. Commerce, UPayments, refunds, and recovery

| Requirement | Status | Evidence |
|---|---|---|
| Server-authoritative order creation | Proven locally; deployed runtime pending | order RPC and `v2-upayments-checkout` |
| UPayments is the only active V2 gateway | Proven locally; sandbox matrix pending | V2 routes/functions; PayPal handlers retired/read-only |
| Immutable payment events before state changes | Proven locally | payment attempt/event schema and functions |
| Customer, order, amount, currency, status reconciliation | Proven locally; negative runtime probes pending | UPayments shared validation and settlement RPC |
| Idempotent duplicate/delayed callbacks | Proven locally; sandbox retry pending | unique keys, advisory locks, function tests |
| Individual, cart, lifetime, remaining-balance checkout | Proven locally; sandbox matrix pending | checkout/order functions and pages |
| Failed-payment recovery | Proven locally; rendered/runtime pending | cancel/return pages and admin Recovery queue |
| Refund request/provider/status/reversal | Proven locally; sandbox refund status pending | refund function/RPC/UI |
| Receipt delivery and admin resend | Proven locally but deliberately disabled | `ADMIN_RECEIPT_RESEND_ENABLED=false` until migration/function verification |
| Historical PayPal read-only | Proven locally | account/order legacy history plus retired handlers |
| Double-question-mark callback normalization | Proven locally; live regression pending | callback parser and return routes |

## 8. Trust, scans, communications, settings, and roles

| Requirement | Status | Evidence |
|---|---|---|
| Package validation and fail-closed effective state | Proven locally; deployed runtime pending | upload/scan functions and scan contracts |
| Cloudmersive clean/malicious/unavailable outcomes | Proven locally; final sandbox matrix pending | provider adapter/tests and Trust queue |
| Reports and package scan operations | Proven locally; rendered QA pending | Trust routes and details |
| Transactional templates and delivery health | Proven locally; runtime pending | canonical communication routes/contracts |
| Payments, email, storage, integrations, roles settings | Proven locally; rendered QA pending | dedicated settings pages and settings contracts |
| Admin activity and security events | Proven locally; role/runtime pending | audit/security dashboards and hardened RPCs |

## 9. Data, authorization, and migration

| Requirement | Status | Evidence |
|---|---|---|
| All named V2 core entities | Proven locally and in production data | foundation migration and production schema |
| RLS/admin/customer permissions | Proven locally and deployed | security scan `95a2265c-60b9-48bd-ab3c-7ae4c02d00dc`; corrective commit `48978150`; 88/88 focused authorization tests; PostgreSQL 16 policy/function rehearsal; production migration/probes |
| Public catalog excludes reusable paid content | Proven locally and deployed | private version-content migration and production probes |
| Service-only tables fail closed | Proven in production data | RLS/no-policy tables documented in advisor triage |
| Legacy lifetime and collection rights preserved | Proven in production data | one `v2_legacy_migration_executed` activity event; entitlement/credit rows exist |
| PayPal conversion policy and 30,000-fils cap | Proven locally and migrated | deterministic 307.55 fils/USD policy and legacy executor |
| Historical records remain intact | Proven by migration design and reconciliation | additive entitlement/credit migration; no destructive transaction rewrite |
| Migration totals reconcile | Proven after controlled deployment | 247 Auth users/profiles; 0 profile/role gaps; 3 orders; 11 payment events; 117 entitlements; 57 lifetime-credit entries |

Production aggregate snapshot at audit time:

- 66 resources; 65 published.
- 65 active individual offers and one active lifetime offer.
- Three V2 orders, 11 payment events, one refund.
- 117 entitlements and 57 lifetime-credit entries.
- One package scan.
- One recorded legacy migration execution.

These counts contain no customer-identifying data and are a point-in-time
snapshot, not launch acceptance by themselves.

## 10. Quality and launch gates

| Requirement | Status | Evidence |
|---|---|---|
| TypeScript, scoped V2 lint, all source tests, production build | Proven locally on 2026-07-29 | `bun run verify:v2`: typecheck, lint, 950 tests, and production build passed |
| Formal V2 security diff review | Proven locally | 85/85 changed files reviewed; both findings fixed in `48978150`; focused and real-database authorization checks passed |
| Fresh dependency/security review | Proven locally | `docs/security/DEPENDENCY_RISK_REGISTER.md` |
| Supabase advisor triage | Proven for current production state | `docs/security/SUPABASE_ADVISOR_TRIAGE_2026-07-29.md` |
| Desktop/mobile English/Arabic rendered QA | Proven against locked Lovable preview | route sweep and mobile/RTL evidence in `docs/V2_CONTROLLED_DEPLOYMENT_REPORT_2026-07-29.md` |
| Anonymous/customer/admin/insufficient-role QA | Proven through rendered and contract checks | controlled deployment report and authorization suites |
| UPayments success/failure/cancel/retry/mismatch/refund | Accepted mixed live/deterministic matrix | `docs/V2_PROVIDER_RELEASE_MATRIX_2026-07-29.md` |
| Cloudmersive clean/malicious/unavailable | Accepted mixed live/deterministic matrix | `docs/V2_PROVIDER_RELEASE_MATRIX_2026-07-29.md` |
| Core Web Vitals targets | Lab evidence recorded; field p75 pending launch traffic | Mobile lab: FCP 2.43s, LCP 4.81s, CLS 0.00014, TBT 10ms; desktop score 99; see `docs/V2_PERFORMANCE_EVIDENCE_2026-07-29.md` |
| Backup and rollback evidence | Proven in controlled deployment | restricted pre-deployment backup and deployment report |
| Stability monitoring and named owners | Pending 24-hour close-out | `docs/V2_STABILITY_AND_OPERATIONS_2026-07-29.md` |
| Separate launch approval | Not authorized | required before `PUBLIC_LAUNCH_LOCK=false` |

## Deferred by locked scope

- Invite-only creator contributions: V2.1.
- Creator storefronts, commissions, KYC, and payouts: V2.2.
- Subscriptions or recurring billing: not planned.

## Remaining critical path

1. Keep Coming Soon enabled through the restarted 24-hour stability window
   ending no earlier than 2026-07-30 17:06 UTC.
2. Confirm the named monitoring, support, rollback-decision, and technical
   rollback owners.
3. Run the close-out log, reconciliation, dependency, advisor, and canonical
   build/test checks.
4. Perform the final evidence audit.
5. Enable field Core Web Vitals monitoring for the launch ramp and enforce the
   documented stop/rollback thresholds.
6. Request a separate approval to unlock and publish.

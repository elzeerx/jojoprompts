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
| Local frontend commit on Lovable | Proven at controlled head | Lovable synchronized and published locked head `6f6d1c90` |
| Database schema | Proven after controlled deployment | Seven release/reconciliation/telemetry migrations applied and totals reconciled |
| Edge Function bundle | Proven after controlled deployment | Five changed functions deployed; unchanged V2 targets contract-probed |
| Admin/customer rendered behavior | Proven against locked preview | Desktop/mobile English/Arabic route sweeps, post-performance Explore smoke, and responsive Core Web Vitals panel QA |
| Controlled deployment approval | Approved | Project owner approved the controlled pass in the Codex task on 2026-07-29; this does not authorize public launch |
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
| Individual purchase update rights are version-aware | Proven after controlled deployment | `resource_versions`, `version_major`, `authorize_resource_download`; secure-version probes |
| Lifetime includes current/future Jojo-owned resources only | Proven locally | library-scope entitlement checks; public copy and legal/FAQ contracts |
| Creators, commissions, KYC, and payouts excluded | Proven in production data | no creator/commission/payout/KYC/earnings tables; resource writes remain admin-only |
| Future-compatible `owner_id` without creator access | Proven locally and in production data | `resources.owner_id`; the one non-null production owner has an admin role |

## 2. Pricing and lifetime credit

| Requirement | Status | Evidence |
|---|---|---|
| Locked suggested price table | Proven locally | `src/config/v2Pricing.ts`; publisher `TYPE_PRICE_HINT` and defaults |
| Admin-editable authoritative prices | Proven in synced preview and deployed RPCs | `ResourcePublisher.tsx`; server draft/order RPCs; controlled publisher QA |
| Eligible settled purchases add actual paid value | Proven locally | settlement allocation and `lifetime_credit_entries` migrations |
| Remaining lifetime balance shown | Proven locally | `LifetimeProgress.tsx`; `LifetimeUpgradeCard.tsx`; account/library/detail surfaces |
| Threshold crossing auto-grants lifetime | Proven locally | settlement RPC locks and `lifetime_threshold` entitlement creation |
| Direct lifetime checkout grants same library scope | Proven locally | order/settlement functions and entitlement contracts |
| Discounts count actual paid value | Proven locally | server-authoritative order totals and credit allocation |
| Refunds reverse credit and threshold-derived lifetime | Accepted mixed live/deterministic matrix | Refund submission reached UPayments; sandbox returned `work_in_production_only`; deterministic reversal/allocation contracts passed without revoking rights on failure |
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
| Mobile filter bottom sheet | Proven in synced mobile preview | mobile Drawer implementation and 390×844 route QA |
| Preserved scroll position and quick preview | Proven in synced preview | `scrollCache`; `QuickPreviewSheet.tsx`; controlled Explore interaction QA |
| Structured skill/automation cards | Proven locally | `SkillResourceCard.tsx` |
| Two-column mobile masonry for visual resources | Proven locally and rendered | `ExploreCatalogContent.tsx`; `VisualResourceCard.tsx`; masonry contract and 390x844 QA |
| No hover-only controls | Proven in synced desktop/mobile preview | mobile-visible actions, focus-visible paths, and route QA |
| 44px minimum touch targets | Proven in synced mobile preview | V2 contracts plus measured public/admin/receipt targets |
| Arabic RTL content/control order | Proven in synced preview | language-aware `dir`; bilingual publisher/detail and RTL route QA |
| Canonical URLs, metadata, structured data, share previews | Proven in synced preview and contracts | `SeoHead.tsx`, SEO contracts, and controlled route inspection |
| Legacy prompt URL compatibility | Proven in synced preview and contracts | redirects in `App.tsx`; public-shell and controlled route checks |

## 4. Resource cards and details

| Requirement | Status | Evidence |
|---|---|---|
| Title, outcome, type, platforms, effort | Proven locally | skill/visual cards and explore result shape |
| Version, update date, trust state | Proven locally | card metadata helpers/contracts |
| Free, price, Owned, Included with Lifetime | Proven locally | ownership label precedence and card contracts |
| View/Get/Add-to-cart actions | Proven in synced preview and contracts | card buttons, acquisition/cart hooks, and controlled interaction QA |
| Skill overview, examples, limitations, uninstall, support, updates | Proven locally | detail page plus newly exposed bilingual publisher fields |
| Platform-specific installation | Proven locally | installation guide schema, bilingual editor, and localized renderer |
| Files, size, checksum, version | Proven after controlled deployment | detail downloads, immutable metadata, and entitlement-checked signed-download probes |
| Permissions, dependencies, services, secrets | Proven locally | permission kinds and bilingual detail/editor |
| License terms and update rights | Proven locally | license schema, bilingual editor, detail copy |
| Individual and lifetime alternatives | Proven locally | resource detail purchase/lifetime cards |

## 5. My Library and delivery

| Requirement | Status | Evidence |
|---|---|---|
| Permanent owned-resource library | Proven in synced preview and role probes | `LibraryPage.tsx`; library RPC/contracts; customer/admin/insufficient-role QA |
| Lifetime-included resources | Proven locally | library-scope entitlement resolution |
| Versions, files, receipts, licenses, guides, updates | Proven in synced preview and deployed services | library/order/detail surfaces and controlled role QA |
| Private package storage | Proven in production data | `resource-packages` bucket is private with 25 MiB limit |
| Entitlement-checked signed URLs | Proven after controlled deployment | `resource-download/index.ts`; 60-second signed URL; authorization RPC and live denial probes |
| Unauthorized/expired/refunded/revoked/version-mismatched denial | Proven after controlled deployment | authorization SQL, secure-version tests, and controlled negative probes |
| Published files/versions are immutable | Proven after controlled deployment | applied private-content migration plus publisher/package probes |

## 6. Admin V2 structure and friction removal

| Requirement | Status | Evidence |
|---|---|---|
| Dedicated admin shell without public chrome | Proven in synced preview | `/admin` shell and controlled desktop/mobile route QA; `d397c76f` renders one non-nested `main` landmark |
| Target navigation groups/routes | Proven locally | `adminNavConfig.ts`; `adminSectionElements.tsx` |
| Attention Required queues | Proven in synced preview and deployed metrics | `OverviewV2.tsx`; metrics RPC; controlled admin QA |
| Server-defined KWD metrics and periods | Proven in synced preview and deployed metrics | overview metrics SQL/UI/contracts |
| Operations table, filters, saved views, pagination | Proven in synced preview | `CatalogTable.tsx` and controlled admin QA |
| Bulk lifecycle actions and optional card view | Proven in synced preview and contracts | catalog lifecycle helpers, table/card modes, controlled QA |
| Unified eight-stage resource publisher | Proven in synced preview and contracts | `ResourcePublisher.tsx`; controlled create/validate/review lifecycle QA; dynamic/version fields expose stable accessible names at `d397c76f` |
| Bilingual metadata and delivery fields | Proven locally | publisher round-trips Arabic changelogs, platform notes, guides, permissions, licenses, products, and public detail copy |
| AI Studio and JSON importer handoff | Proven in synced preview and contracts | import routes, controlled admin QA, and contract tests |
| Untouched AI Studio sessions do not persist resources | Proven locally | deferred draft/resource creation contracts |
| Draft, review, publish, version, archive, restore, activity | Proven after controlled deployment | lifecycle RPCs, queues, catalog, versions, activity routes, and controlled QA |
| No active subscription/plan controls | Proven locally | V2 admin route registry; Users/Communications/Taxonomy contracts |
| No active permanent category/user/resource deletion | Proven locally | Users V2, taxonomy deactivation, catalog archive/restore |
| AI Studio drafts are archive/restore, not hard delete | Proven locally | `DraftsSidebar.tsx` and AI Studio contract |
| No primary admin Favorites/Add Prompt/duplicate communications | Proven locally | route/nav registry and active-section contracts |
| No placeholder primary admin pages | Proven locally | every registered admin route maps to a concrete V2 section |

## 7. Commerce, UPayments, refunds, and recovery

| Requirement | Status | Evidence |
|---|---|---|
| Server-authoritative order creation | Proven after controlled deployment | order RPC, `v2-upayments-checkout`, and captured 0.900 KWD sandbox order |
| UPayments is the only active V2 gateway | Proven in deployed V2 and sandbox matrix | V2 routes/functions; PayPal handlers retired/read-only |
| Immutable payment events before state changes | Proven locally | payment attempt/event schema and functions |
| Customer, order, amount, currency, status reconciliation | Proven through live/deterministic matrix | UPayments shared validation, settlement RPC, provider recheck, and mismatch rejection contracts |
| Idempotent duplicate/delayed callbacks | Proven through deployed source and deterministic matrix | unique keys, advisory locks, fetched webhook/status bundles, and retry tests |
| Individual, cart, lifetime, remaining-balance checkout | Proven through deployed services and matrix | checkout/order functions, pages, captured individual payment, and deterministic product-mode contracts |
| Failed-payment recovery | Proven in synced preview and live failed attempts | cancel/return pages, status recovery, and Admin Recovery queue |
| Refund request/provider/status/reversal | Accepted mixed live/deterministic matrix | real sandbox submission returned production-only 422 without rights loss; reversal contracts pass |
| Receipt delivery and admin resend | Activated after controlled gate | exact webhook/status/admin bundles verified; admin-only confirmation UI enabled at `082505f2`; no email sent during QA |
| Historical PayPal read-only | Proven locally | account/order legacy history plus retired handlers |
| Double-question-mark callback normalization | Proven in live callback and regression contracts | callback parser, normalized return route, and captured payment recovery |

## 8. Trust, scans, communications, settings, and roles

| Requirement | Status | Evidence |
|---|---|---|
| Package validation and fail-closed effective state | Proven after controlled deployment | upload/scan functions, live benign scan, and fail-closed contracts |
| Cloudmersive clean/malicious/unavailable outcomes | Accepted mixed live/deterministic matrix | live clean result plus malicious/contradictory/unavailable/retry-exhaustion provider contracts |
| Reports and package scan operations | Proven in synced preview | Trust routes, scan details, and controlled admin QA |
| Transactional templates and delivery health | Proven in synced preview and contracts | canonical communication routes/contracts and controlled admin QA |
| Payments, email, storage, integrations, roles settings | Proven in synced preview | dedicated settings pages and controlled desktop/mobile QA |
| Admin activity and security events | Proven in synced preview and role probes | audit/security dashboards, hardened RPCs, and controlled admin/denial QA |

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
| TypeScript, scoped V2 lint, all source tests, production build | Proven locally on 2026-07-30 | `bun run verify:v2`: typecheck, lint, 973 tests, and production build passed at `6f6d1c90` |
| Formal V2 security diff review | Proven locally | 85/85 changed files reviewed; both findings fixed in `48978150`; focused and real-database authorization checks passed |
| Fresh dependency/security review | Refreshed on 2026-07-30; reviewed exception unchanged | Production: 0 critical, 2 high package nodes for one non-reachable RSC-only advisory; full: 0 critical, 9 high, 3 moderate, 1 low; `docs/security/DEPENDENCY_RISK_REGISTER.md` |
| Supabase advisor triage | Proven for current production state | `docs/security/SUPABASE_ADVISOR_TRIAGE_2026-07-29.md` |
| Desktop/mobile English/Arabic rendered QA | Proven against locked Lovable preview | route sweep and mobile/RTL evidence in `docs/V2_CONTROLLED_DEPLOYMENT_REPORT_2026-07-29.md` |
| Anonymous/customer/admin/insufficient-role QA | Proven through rendered and contract checks | controlled deployment report and authorization suites |
| UPayments success/failure/cancel/retry/mismatch/refund | Accepted mixed live/deterministic matrix | `docs/V2_PROVIDER_RELEASE_MATRIX_2026-07-29.md` |
| Cloudmersive clean/malicious/unavailable | Accepted mixed live/deterministic matrix | `docs/V2_PROVIDER_RELEASE_MATRIX_2026-07-29.md` |
| Accessibility and assistive technology | Technical acceptance passed on 2026-07-30 | Synced `d397c76f` passed 200% English/Arabic zoom and reflow, reduced-motion emulation, keyboard focus, landmark, accessible-name, responsive, and RTL checks; see `docs/V2_ACCESSIBILITY_ACCEPTANCE_2026-07-30.md` |
| Bilingual legal and standard Jojo license wording | Technical consistency passed; owner/legal acceptance pending | Active Terms, Privacy, FAQ, Pricing, and route contracts passed 35/35 focused checks; sign-off checklist: `docs/V2_OWNER_LEGAL_ACCEPTANCE_CHECKLIST_2026-07-30.md` |
| Core Web Vitals targets | Monitoring deployed; production p75 pending launch traffic | Mobile lab: FCP 2.43s, LCP 4.81s, CLS 0.00014, TBT 10ms; privacy-safe RUM and admin p75 panel deployed; see `docs/V2_PERFORMANCE_EVIDENCE_2026-07-29.md` |
| Backup and rollback evidence | Proven in controlled deployment | restricted pre-deployment backup and deployment report |
| Stability monitoring and named owners | Operational owner confirmed; technical close-out current | Nawaf Alsuwaiyed holds monitoring, support, rollback-decision, and technical rollback roles; `docs/V2_STABILITY_AND_OPERATIONS_2026-07-29.md` |
| Separate launch approval | Not authorized | required before `PUBLIC_LAUNCH_LOCK=false` |

## Deferred by locked scope

- Invite-only creator contributions: V2.1.
- Creator storefronts, commissions, KYC, and payouts: V2.2.
- Subscriptions or recurring billing: not planned.

## Remaining critical path

1. Keep Coming Soon enabled through the restarted 24-hour stability window
   ending no earlier than 2026-07-31 19:20 UTC
   (22:20 Asia/Kuwait).
2. Confirm the named monitoring, support, rollback-decision, and technical
   rollback owners.
3. Record owner/legal acceptance for the bilingual Terms, Privacy, refund,
   lifetime-credit, and standard Jojo license wording.
4. Run the close-out log, reconciliation, dependency, advisor, and canonical
   build/test checks.
5. Perform the final evidence audit.
6. Use the deployed field Core Web Vitals monitoring during the launch ramp
   and enforce the documented stop/rollback thresholds.
7. Request a separate approval to unlock and publish.

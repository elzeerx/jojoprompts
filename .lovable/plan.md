# JojoPrompts V2.0 — Audit & Next Slice

Read-only audit against the approved V2.0 plan following completed UPayments sandbox payment/retry QA and the known production-only refund test blocker. Nothing was edited, deployed, or published in this turn. Production remains behind `PUBLIC_LAUNCH_LOCK=true`, `V2_COMMERCE_ENABLED=false`, `V2_UPAYMENTS_ENABLED` unset. Creator features remain deferred.

## Repository-verified status

Complete (evidence in tree):
- **Legacy migration (Phase 6B.1/6B.2/6B.3)** — `private` schema executor + rehearsal cleanup, `v2_admin_migration_preview/rehearsal/verification` RPCs, admin `LegacyMigrationPreview` + `VerificationCard`, customer `LegacyAccessSummary`. Verification drift = 0 (116 entitlements / 56 credits).
- **Launch lock (Phase 6B.2)** — `src/config/siteMode.ts` fail-closed helper, `ComingSoonPage`, admin bypass. Confirmed regex-anchored preview allowlist.
- **UPayments sandbox integration (Phase 6C)** — `_shared/v2Upayments.ts` with documented field limits, KWD float refunds, `NOT CAPTURED`/`NOT_CAPTURED` terminal aliases, transaction-vs-hosted session disambiguation. 41/41 Deno tests.
- **Checkout return / cancel / retry flow** — `V2CheckoutReturnPage`, `V2CheckoutCancelPage` with authenticated status verification and gated "Try payment again", parameterized `/checkout/return/:orderId` and `/checkout/cancel/:orderId` routes, `callbackOrderId.ts` parser.
- **Admin commerce recovery & reconciliation (Phase 5.4)** — `RecoveryPage` 10-metric dashboard, `v2_admin_reconcile_order`, `v2_admin_finalize_definite_refund_rejection` with error-code regex guard, `RefundDetailSheet` diagnostics.
- **Refund pipeline (RPC + edge)** — schema-drift fix for `v2_admin_get_refundable_order`, deployed `v2-upayments-refund`. Real refund still blocked until production sandbox switch by the known external constraint.
- **V2 catalog + library** — `ExplorePage`, `PromptsCatalogPage`, `SkillsPage`, `AutomationsPage`, `BundlesPage`, `ImageStylesPage`, `ResourceDetailPage`, `LibraryPage`, `V2OrdersPage`, download flow via `resource-download` edge + `useResourceDownload`.
- **Cart + checkout server guards** — `useAuthoritativeCart`, `v2-upayments-checkout` with idempotency, ownership, pending-order, amount/currency, and lifetime-inclusion guards.

Incomplete / deferred (evidence-backed):
- **V2 post-purchase confirmation email** — `grep` across `supabase/functions/v2-upayments-webhook`, `v2-upayments-status`, `v2_apply_paid_order_locked`, `V2CheckoutReturnPage`, and `V2OrdersPage` finds **no receipt/confirmation email code path for V2 paid orders**. Legacy `send-purchase-confirmation` is V1-only. `V2OrdersPage` only offers browser "Print receipt".
- **Production refund end-to-end validation** — blocked externally until UPayments production credentials + a real low-value refundable purchase exist. Not actionable now.
- **`V2_COMMERCE_ENABLED` cutover + prompts route swap** — `V2_CUTOVER_ROUTES` documented in `v2Flags.ts` but intentionally not wired; correct to defer until receipts + owner-side sanity checks pass.
- **Creator features (payouts, submissions, RevShare)** — deferred by policy. Not audited.
- **Abandoned-cart email for V2 carts** — legacy `send-abandoned-cart-email` exists; V2 cart wiring not present. Lower priority than receipts.

## Single next unfinished slice

**V2 post-purchase confirmation email (receipt + library link) on verified paid orders.**

### Why this is next
1. It is the last customer-visible gap on the happy path before any launch discussion. Customers currently complete a paid UPayments checkout and get zero email evidence of the purchase.
2. It is **independent** of the production refund blocker and of creator work.
3. It reuses infrastructure that already exists: `send-email` edge function, `email_logs`, `email_templates`, and `v2_apply_paid_order_locked` as the single canonical "order became paid" pivot.
4. It does not require flipping any launch/commerce flag — it can be validated end-to-end against sandbox purchases and the admin's own account before flags flip.
5. It does not touch UPayments contract, RLS, entitlements grants, or refund logic — so it cannot regress the finished slices.

### Scope (implementation-time, not now)

Files / services expected to be involved:
- New edge function `supabase/functions/v2-send-order-receipt/` (service-role, `verify_jwt=false`, invoked only by webhook/status with a signed payload OR called from a trusted DB trigger via `pg_net`). Renders receipt using existing email template infra.
- New DB migration:
  - New row(s) in `email_templates` for `v2_order_receipt_en` / `v2_order_receipt_ar` (or JSONB bilingual variant matching existing template shape).
  - Idempotency column on `orders` (e.g. `receipt_email_sent_at timestamptz`) OR a dedicated `email_logs` lookup keyed by `(order_id, template='v2_order_receipt')` to guarantee exactly-once send across webhook + status retries.
  - Optional trigger on `orders` transition to `paid` that enqueues the send — preferred over calling from every settlement code path.
- Update `supabase/functions/v2-upayments-webhook/index.ts` and `v2-upayments-status/index.ts` only if a trigger cannot be used; otherwise leave them untouched (preferred).
- No frontend changes strictly required; optionally surface "Receipt emailed to …" on `V2CheckoutReturnPage` and `V2OrdersPage` once the send is recorded.
- Bilingual copy in `src/i18n` if any UI surfacing is added.

### Dependencies / preconditions
- Existing `send-email` edge function must be reachable from service-role context (already true).
- Order row must have canonical totals in fils, currency, and buyer email — all present today via `orders` + `profiles` join.
- Must not depend on `V2_UPAYMENTS_ENABLED` or `V2_COMMERCE_ENABLED` (send fires purely on `orders.status='paid'`, so it works for the admin's own sandbox smoke tests without flipping public flags).

### Acceptance tests
1. **Idempotency:** simulating two webhook deliveries + a status finalize for the same order results in exactly one `email_logs` row with template `v2_order_receipt` and exactly one outbound send. Rerun should be a no-op.
2. **Content correctness:** receipt shows order id, purchased line items (title EN/AR, resource type), subtotal, discount (if any), total in KWD with fils precision, payment provider = UPayments, and a deep link to `/library` (or `/orders/:id`).
3. **Language:** falls back to English but sends Arabic when `profiles.preferred_language='ar'`.
4. **Failure isolation:** email send failure must not roll back the `paid` transition or entitlement grants; it must record an `email_logs` failure row so admin recovery can retry.
5. **RLS/permissions:** the new template send path is invocable only by service_role (or by the trigger); anon/authenticated cannot invoke it directly.
6. **Regression:** all existing `_shared/v2Upayments_test.ts` Deno tests pass unchanged; `npx tsgo --noEmit` and `npm run build` remain clean.
7. **Admin visibility:** the receipt appears in `email_logs` with `template_key` and `order_id`, so `RecoveryPage`/order detail can surface delivery status without new tables.

### Explicit non-goals for this slice
- No changes to entitlement grants, refund flow, cart/checkout guards, discount RPCs, or `V2CheckoutCancelPage` retry logic.
- No flipping of `PUBLIC_LAUNCH_LOCK`, `V2_COMMERCE_ENABLED`, or `V2_UPAYMENTS_ENABLED`.
- No production refund testing (still externally blocked).
- No creator/payouts work.
- No prompts-route cutover (`V2_CUTOVER_ROUTES` stays documentation-only).

### Reporting on completion (when built)
Exact migration filename, new edge function path + deployed version, list of frontend files touched (if any), test counts, and a screenshot of a sandbox receipt sent to the admin's own address.

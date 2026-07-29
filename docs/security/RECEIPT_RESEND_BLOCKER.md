# Admin Order-Receipt Resend — Architecture

**Status:** activated after the controlled deployment gate on 2026-07-29.
The migration is applied; the admin resend, UPayments webhook, and UPayments
status bundles match reviewed source byte-for-byte; table/RLS/RPC boundaries
passed live checks; and an unauthenticated probe returned 401 without creating
a request. `ADMIN_RECEIPT_RESEND_ENABLED=true`.

The activation gate also verified `v2-upayments-webhook` and
`v2-upayments-status`, because Supabase bundles their imported shared receipt
module into each function version. Their deployed source matches the reviewed
direct-REST idempotency implementation, including the real
`Idempotency-Key` header.

Superseded the previous "blocker" note. The unsafe design that would have
tried to re-open the original `v2_order_receipt_deliveries` row is
**explicitly rejected**. See the reasoning below.

## Why the original delivery row is never reopened

`v2_order_receipt_deliveries` implements a single-shot claim/complete state
machine driven by `v2_claim_order_receipt_delivery`. Its Resend idempotency
key is derived deterministically from the order id
(`receiptIdempotencyKey(orderId)` → `v2-order-receipt/{orderId}`). Reusing
that row for an admin resend would:

1. Race the original background delivery task.
2. Hit Resend's provider-side idempotency dedup and silently no-op instead
   of actually sending the second copy.
3. Break the single-success-per-order invariant enforced by the partial
   unique index on `email_logs` for `email_type = 'v2_order_receipt'`.

## The separate resend-request model

A new audited table `public.v2_order_receipt_resend_requests` (see
[forward-only migration](../../supabase/migrations/20260728152000_admin_receipt_resend_requests.sql))
holds every admin-initiated resend as its own row. Seven
`SECURITY DEFINER SET search_path = ''` service-role-only functions gate
every transition:

| Function | Purpose |
|---|---|
| `v2_internal_create_receipt_resend_request(order, admin, reason)` | Validates admin role, order eligibility, canonical recipient email, active-request/cooldown/cap rules; inserts one `pending` row and one safe `activity_events` audit entry. |
| `v2_internal_claim_receipt_resend_request(request_id)` | Atomic `pending → processing`. |
| `v2_internal_require_receipt_resend_reconciliation(request_id, error...)` | Changes an ambiguous `processing` request to `reconciliation_required` without inventing a new provider key. |
| `v2_internal_claim_receipt_resend_reconciliation(request_id, admin)` | Claims `reconciliation_required` (or a stale `processing` row) for a same-key, same-payload provider retry inside the safe retention window. |
| `v2_internal_resolve_receipt_resend_reconciliation(request_id, admin, resolution, reason)` | Records an explicit provider-dashboard review after automatic reconciliation is no longer safe. |
| `v2_internal_complete_receipt_resend_request(request_id, provider_msg_id)` | `processing → sent` with sanitized provider id and an `order_receipt_resend_sent` audit event. |
| `v2_internal_fail_receipt_resend_request(request_id, code, message)` | `pending/processing → failed` with sanitized code/message and an `order_receipt_resend_failed` audit event. |

Guarantees:

* At most **one** active request (`pending`/`processing`/`reconciliation_required`) per order,
  enforced by a partial unique index AND an explicit RPC check.
* **5-minute cooldown** since `max(original sent_at, latest resend requested_at)`.
* **Per-order cap** of 5 resend requests per rolling 24 h.
* **Per-admin cap** of 50 resend requests per rolling 24 h.
* Transaction-scoped advisory locks serialize the per-order and per-admin
  checks, so concurrent requests cannot race past the rolling caps.
* A claim failure is closed as a failed request before any provider call; if
  that cleanup cannot be proven, the endpoint returns
  `reconciliation_required` and does not create another delivery.
* Provider-returned rejections are definitive failures, except Resend's
  `concurrent_idempotent_requests`, which explicitly means the same request is
  still in flight. Transport/runtime exceptions and concurrent-key responses
  become `reconciliation_required`.
* The exact provider payload is persisted **before** the first provider call in
  `v2_order_receipt_resend_payloads`. That table has no authenticated grant or
  RLS policy; only `service_role` can read it. A recovery call therefore reuses
  both the original idempotency key and byte-equivalent email content.
* Automatic reconciliation is capped at five attempts and 23 hours. Resend
  retains idempotency keys for 24 hours; the one-hour margin prevents an
  expired key from turning a retry into a duplicate send.
* Once safe automatic reconciliation is unavailable, an admin must verify the
  outcome in Resend and explicitly record `sent` or `failed` with a bounded
  review note. The actor, timestamp, note, and resolution are audited.
* Order must be `paid` or `partially_refunded`; anything else is rejected
  server-side. Fully refunded / pending / failed / cancelled orders are ineligible.
* `activity_events` records the requesting admin in `actor_user_id`; metadata
  contains **only** `request_id` and `status`. It never contains email, amount,
  items, HTML, provider payload, or provider error text.

## Distinct Resend idempotency key

The shared receipt module now exports two keys:

* `receiptIdempotencyKey(orderId)` → `v2-order-receipt/{orderId}` — the
  original single-shot delivery. Unchanged.
* `receiptResendIdempotencyKey(requestId)` → `v2-order-receipt-resend/{requestId}` —
  used **only** by the admin resend Edge Function. Because each admin resend
  gets a new request id, each attempt has its own idempotency key and
  Resend will not dedupe a legitimate admin retry against an earlier resend.

The transport uses the shared direct REST helper in `resendClient.ts`, which
sets the real HTTP `Idempotency-Key` header. It deliberately does not use the
old `resend@2.0.0` SDK: that release predates SDK idempotency support and
silently ignores an `idempotencyKey` property passed as its second argument.

## Edge Function `v2-admin-resend-order-receipt` (verify_jwt=true)

Accepts exactly one strict command:

* `{ order_id: uuid, reason: string(3..300) }` — create a new resend.
* `{ request_id: uuid }` — reconcile the same ambiguous request.
* `{ request_id: uuid, resolution: 'sent'|'failed', reason: string(3..300) }`
  — record an explicit provider review.

Any extra field is rejected. Recipient/amount/items are **always** loaded
from canonical DB rows for a new send, and reconciliation reads the persisted
service-only payload. The browser cannot override receipt content.

New-send flow: `create RPC` → `claim RPC` → server-side `loadReceiptOrder`
(with `allowPartialRefund`) → `renderReceiptHtml` → persist exact provider
payload → `sendReceiptPayloadViaResend(payload,
receiptResendIdempotencyKey(requestId))` → `complete/fail/reconciliation RPC`
→ `email_logs` row with `email_type = 'v2_order_receipt_resend'`.

If Resend accepts the send but the DB complete write fails, the function
returns HTTP `202 { error: 'reconciliation_required', request_id,
provider_message_id }` instead of retrying blindly with a different key.

## What the admin UI does

`OrderDetailSheet.tsx` shows a confirmation-gated `Resend receipt` action
for `paid` and `partially_refunded` orders. The reason is required
(3–300 chars) and the button is disabled while the original delivery is
still processing or a resend mutation is in flight. Below the button, the
sheet renders the resend history (`useOrderReceiptResendRequests`) with
status, timestamps, reason, sanitized error code, provider id, and
reconciliation attempts. Ambiguous rows expose `Reconcile safely` while the
same-key window is open. After the window or attempt cap, the UI requires an
explicit Resend-dashboard review and confirmation before recording `sent` or
`failed`. There is no permanent-delete or reopen action — server RPCs are the
sole authority.

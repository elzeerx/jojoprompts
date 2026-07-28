# Admin Order-Receipt Resend — Architecture

**Status:** designed (source + reviewed draft migration, awaiting apply/deploy).

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
[draft migration](drafts/20260728152000_admin_receipt_resend_requests.sql))
holds every admin-initiated resend as its own row. Four
`SECURITY DEFINER SET search_path = ''` service-role-only functions gate
every transition:

| Function | Purpose |
|---|---|
| `v2_internal_create_receipt_resend_request(order, admin, reason)` | Validates admin role, order eligibility, canonical recipient email, active-request/cooldown/cap rules; inserts one `pending` row and one safe `activity_events` audit entry. |
| `v2_internal_claim_receipt_resend_request(request_id)` | Atomic `pending → processing`. |
| `v2_internal_complete_receipt_resend_request(request_id, provider_msg_id)` | `processing → sent` with sanitized provider id and an `order_receipt_resend_sent` audit event. |
| `v2_internal_fail_receipt_resend_request(request_id, code, message)` | `processing → failed` with sanitized code/message and an `order_receipt_resend_failed` audit event. |

Guarantees:

* At most **one** active request (`pending`/`processing`) per order,
  enforced by a partial unique index AND an explicit RPC check.
* **5-minute cooldown** since `max(original sent_at, latest resend requested_at)`.
* **Per-order cap** of 5 resend requests per rolling 24 h.
* **Per-admin cap** of 50 resend requests per rolling 24 h.
* Order must be `paid` or `partially_refunded`; anything else is rejected
  server-side. Fully refunded / pending / failed / cancelled orders are ineligible.
* `activity_events` metadata contains **only** `request_id`, `status`, and
  (on failure) the sanitized `error_code`. It never contains email, amount,
  items, HTML, or provider payload.

## Distinct Resend idempotency key

The shared receipt module now exports two keys:

* `receiptIdempotencyKey(orderId)` → `v2-order-receipt/{orderId}` — the
  original single-shot delivery. Unchanged.
* `receiptResendIdempotencyKey(requestId)` → `v2-order-receipt-resend/{requestId}` —
  used **only** by the admin resend Edge Function. Because each admin resend
  gets a new request id, each attempt has its own idempotency key and
  Resend will not dedupe a legitimate admin retry against an earlier resend.

## Edge Function `v2-admin-resend-order-receipt` (verify_jwt=true)

Accepts strictly `{ order_id: uuid, reason: string(3..300) }`. Any other
field is rejected. Recipient/amount/items are **always** loaded from
canonical DB rows on the service client — the browser cannot override them.

Flow: `create RPC` → `claim RPC` → server-side `loadReceiptOrder` (with
`allowPartialRefund`) → `renderReceiptHtml` → `sendReceiptViaResend(order,
rendered, receiptResendIdempotencyKey(requestId))` → `complete/fail RPC` →
`email_logs` row with `email_type = 'v2_order_receipt_resend'`.

If Resend accepts the send but the DB complete write fails, the function
returns HTTP `202 { error: 'reconciliation_required', request_id,
provider_message_id }` instead of retrying blindly with a different key.

## What the admin UI does

`OrderDetailSheet.tsx` shows a confirmation-gated `Resend receipt` action
for `paid` and `partially_refunded` orders. The reason is required
(3–300 chars) and the button is disabled while the original delivery is
still processing or a resend mutation is in flight. Below the button, the
sheet renders the resend history (`useOrderReceiptResendRequests`) with
status, timestamps, reason, sanitized error code, and provider id. There
is no permanent-delete or reopen action — server RPCs are the sole
authority.

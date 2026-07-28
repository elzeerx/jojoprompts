# Admin receipt-resend blocker (source-only note, 2026-07-28)

Live evidence (`v2_claim_order_receipt_delivery`, `v2_complete_order_receipt_delivery`, `v2_fail_order_receipt_delivery` — SECURITY DEFINER, `search_path=''`) shows the shared V2 receipt-delivery pipeline is **built as a single-shot claim/complete state machine**, not a re-triggerable action:

- `v2_claim_order_receipt_delivery` refuses to (re-)claim a row once `status = 'sent'` (line 127 of the function body). It returns `claimed = false` and yields no delivery lease.
- `v2_complete_order_receipt_delivery` only advances a row from `processing` to `sent`; it never resets a `sent` row.
- There is no `service_role`-gated "reset to pending" RPC, and RLS on `public.v2_order_receipt_deliveries` exposes only `SELECT` to admins (policy `admin_read_receipt_deliveries`).

Consequence: any Edge Function that tried to trigger an admin resend by reusing `scheduleReceiptDelivery` / `v2_claim_order_receipt_delivery` would be a **no-op on the exact rows admins actually want to resend** (paid + already-sent). Building it anyway would be a "fake action" that the user explicitly told us not to ship.

Decision: **do not create `v2-admin-resend-order-receipt` yet.** The order-detail drawer surfaces the real receipt-delivery status (sent / failed / processing / attempts / last error / provider message id) so admins can see delivery truth. A `Resend receipt` control is deliberately absent, not disabled-with-a-fake-reason.

Unblocking work (out of scope for this source-only closure, requires a separate reviewed migration + Edge Function deploy):

1. Add a `service_role`-only RPC — e.g. `v2_admin_reopen_receipt_delivery(p_order_id uuid, p_admin_user_id uuid, p_reason text)` — that:
   - Verifies the caller admin role server-side via `has_role`.
   - Verifies the order is `paid`/`settled` and not fully refunded.
   - Enforces a per-order cooldown (e.g. ≥ 5 minutes since last `sent_at`).
   - Sets the row back to a claimable state and increments `max_attempts` by a bounded amount, with an audit trail in `v2_admin_activity_log`.
2. Add an Edge Function `v2-admin-resend-order-receipt` that authenticates the admin, calls the new RPC, then invokes the existing `scheduleReceiptDelivery` runner. The function must **derive recipient / order / items / amount from server records only** and reject any client-supplied override.
3. Wire a confirmation-gated `Resend receipt` control in `OrderDetailSheet.tsx` that appears only when the eligibility RPC returns true.

Until (1)–(3) are reviewed and deployed, the admin UI stays honest: it shows current receipt-delivery status and no resend action.

// Canonical Admin V2 route mapping for the Payments settings page.
// Kept in a leaf module so tests can import route constants without pulling in
// the supabase client or React tree.

export const PAYMENTS_NAV_LINKS: readonly {
  to: string;
  label: string;
  description: string;
}[] = [
  { to: "/admin/orders", label: "Orders", description: "Order-level detail & receipts" },
  { to: "/admin/orders/payment-events", label: "Payment events", description: "Provider event stream" },
  { to: "/admin/orders/entitlements", label: "Entitlements", description: "Granted entitlements" },
  { to: "/admin/orders/refunds", label: "Refunds", description: "Refund requests & processing" },
  { to: "/admin/orders/recovery", label: "Recovery queue", description: "Stalled/unsettled orders" },
  { to: "/admin/orders/discounts", label: "Discounts", description: "One-time payment discount codes" },
];

export const PAYMENTS_RECON_LINKS: Readonly<Record<string, string>> = {
  mismatches: "/admin/orders/payment-events",
  pending_past_due: "/admin/orders/recovery",
  paid_without_entitlement: "/admin/orders",
  credit_inconsistent: "/admin/orders/entitlements",
  duplicate_event_risk: "/admin/orders/payment-events",
  refund_alloc_over_item: "/admin/orders/refunds",
  refund_alloc_over_order: "/admin/orders/refunds",
  processed_missing_credit: "/admin/orders/refunds",
  processed_item_unrevoked_entitlement: "/admin/orders/refunds",
  threshold_lifetime_below_credit: "/admin/orders/entitlements",
};

// Canonical Admin V2 route mapping for the Payments settings page.
// Kept in a leaf module so tests can import route constants without pulling in
// the supabase client or React tree.

export const PAYMENTS_NAV_LINKS: readonly {
  to: string;
  label: string;
  description: string;
}[] = [
  { to: "/admin/commerce?tab=orders", label: "Orders", description: "Order-level detail & receipts" },
  { to: "/admin/commerce?tab=payment-events", label: "Payment events", description: "Provider event stream" },
  { to: "/admin/commerce?tab=entitlements", label: "Entitlements", description: "Granted entitlements" },
  { to: "/admin/commerce?tab=refunds", label: "Refunds", description: "Refund requests & processing" },
  { to: "/admin/commerce?tab=recovery", label: "Recovery queue", description: "Stalled/unsettled orders" },
  { to: "/admin/commerce?tab=discounts", label: "Discounts", description: "One-time payment discount codes" },
];

export const PAYMENTS_RECON_LINKS: Readonly<Record<string, string>> = {
  mismatches: "/admin/commerce?tab=payment-events",
  pending_past_due: "/admin/commerce?tab=recovery",
  paid_without_entitlement: "/admin/commerce?tab=orders",
  credit_inconsistent: "/admin/commerce?tab=entitlements",
  duplicate_event_risk: "/admin/commerce?tab=payment-events",
  refund_alloc_over_item: "/admin/commerce?tab=refunds",
  refund_alloc_over_order: "/admin/commerce?tab=refunds",
  processed_missing_credit: "/admin/commerce?tab=refunds",
  processed_item_unrevoked_entitlement: "/admin/commerce?tab=refunds",
  threshold_lifetime_below_credit: "/admin/commerce?tab=entitlements",
};

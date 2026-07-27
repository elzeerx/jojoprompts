import { useEffect } from "react";
import { useAuthoritativeCart } from "@/hooks/v2/useAuthoritativeCart";
import { cartStore } from "@/hooks/v2/useCart";

/**
 * Silent cross-route cart sanitizer.
 *
 * Whenever authoritative cart resolution completes, we drop lines the
 * customer must not be able to purchase — items they already own, items
 * included with their Lifetime access, missing/inactive products. This
 * keeps the cart badge and totals honest without touching orders,
 * entitlements, or payment code.
 */
export function CartSanitizer() {
  const { data } = useAuthoritativeCart();
  useEffect(() => {
    if (!data) return;
    const drop = data.lines
      .filter(
        (l) =>
          l.status === "owned" ||
          l.status === "included_with_lifetime" ||
          l.status === "missing" ||
          l.status === "inactive",
      )
      .map((l) => l.product_id);
    if (drop.length > 0) cartStore.removeMany(drop);
  }, [data]);
  return null;
}

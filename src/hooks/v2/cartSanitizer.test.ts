import { describe, it, expect } from "bun:test";
import type { AuthoritativeCart, AuthoritativeCartLine } from "@/hooks/v2/useAuthoritativeCart";

/**
 * Pure logic mirror of what CartSanitizer applies to the cart: any line the
 * server flags as owned, included_with_lifetime, missing, or inactive must be
 * dropped so the checkout button and badge never advertise items the customer
 * cannot actually buy.
 */
function computeDropIds(cart: AuthoritativeCart): string[] {
  return cart.lines
    .filter(
      (l) =>
        l.status === "owned" ||
        l.status === "included_with_lifetime" ||
        l.status === "missing" ||
        l.status === "inactive",
    )
    .map((l) => l.product_id);
}

function line(
  product_id: string,
  status: AuthoritativeCartLine["status"],
  price_fils = 900,
): AuthoritativeCartLine {
  return {
    product_id,
    status,
    product_type: "individual",
    price_fils,
    resource_id: null,
    resource_slug: null,
    title_en: "T",
    title_ar: null,
    resource_type: "prompt",
  };
}

describe("CartSanitizer / authoritative cart", () => {
  it("drops owned + lifetime-included + missing + inactive lines", () => {
    const cart: AuthoritativeCart = {
      lines: [
        line("a", "ok"),
        line("b", "owned"),
        line("c", "included_with_lifetime"),
        line("d", "missing"),
        line("e", "inactive"),
      ],
      chargeableIds: ["a"],
      chargeableTotalFils: 900,
      hasBlockers: true,
    };
    expect(computeDropIds(cart).sort()).toEqual(["b", "c", "d", "e"]);
  });

  it("keeps a clean cart untouched", () => {
    const cart: AuthoritativeCart = {
      lines: [line("a", "ok"), line("b", "ok")],
      chargeableIds: ["a", "b"],
      chargeableTotalFils: 1800,
      hasBlockers: false,
    };
    expect(computeDropIds(cart)).toEqual([]);
  });

  it("reports zero chargeable when every line is owned", () => {
    const cart: AuthoritativeCart = {
      lines: [line("a", "owned"), line("b", "included_with_lifetime")],
      chargeableIds: [],
      chargeableTotalFils: 0,
      hasBlockers: true,
    };
    expect(cart.chargeableIds).toHaveLength(0);
    expect(cart.chargeableTotalFils).toBe(0);
    expect(computeDropIds(cart)).toHaveLength(2);
  });
});

import type { MyOrderSummary } from "./useMyOrders.types";

/**
 * Extract an order-summary array from whatever shape the RPC returns.
 * Accepts:
 *   - a raw array (SETOF row style)
 *   - `{ ok: true, orders: [...] }` envelope
 *   - `{ orders: [...] }` without an ok flag
 *   - null / undefined (treated as empty)
 * Any other shape resolves to `[]` — never throws. Prevents a permanent
 * loading skeleton for authenticated accounts with no orders.
 */
export function parseMyOrdersPayload(data: unknown): MyOrderSummary[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as MyOrderSummary[];
  if (typeof data === "object") {
    const maybe = data as { orders?: unknown };
    if (Array.isArray(maybe.orders)) return maybe.orders as MyOrderSummary[];
  }
  return [];
}

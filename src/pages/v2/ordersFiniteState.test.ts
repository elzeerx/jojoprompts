/**
 * Finite-state contract tests for the V2 orders surface. Guards against the
 * "permanent skeleton" bug where an authenticated account with no orders
 * never settled to the empty state.
 */
import { describe, it, expect } from "bun:test";
import { parseMyOrdersPayload } from "../../hooks/v2/parseMyOrdersPayload";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HERE: string =
  (import.meta as unknown as { dir?: string }).dir ?? ".";
const PAGE: string = readFileSync(resolve(HERE, "./V2OrdersPage.tsx"), "utf8");
const HOOK: string = readFileSync(
  resolve(HERE, "../../hooks/v2/useMyOrders.ts"),
  "utf8",
);
const LEGACY_HOOK: string = readFileSync(
  resolve(HERE, "../../hooks/v2/useMyLegacyTransactions.ts"),
  "utf8",
);

describe("parseMyOrdersPayload", () => {
  it("returns [] for null / undefined (settled-empty account)", () => {
    expect(parseMyOrdersPayload(null)).toEqual([]);
    expect(parseMyOrdersPayload(undefined)).toEqual([]);
  });
  it("returns [] for empty envelope without orders array", () => {
    expect(parseMyOrdersPayload({})).toEqual([]);
    expect(parseMyOrdersPayload({ ok: true })).toEqual([]);
  });
  it("passes through envelope shapes", () => {
    expect(parseMyOrdersPayload({ ok: true, orders: [{ id: "1" }] }).length).toBe(1);
    expect(parseMyOrdersPayload({ orders: [{ id: "2" }] }).length).toBe(1);
  });
  it("passes through raw arrays", () => {
    expect(parseMyOrdersPayload([{ id: "3" }]).length).toBe(1);
  });
});

describe("V2OrdersPage finite-state semantics", () => {
  it("gates the skeleton on active fetching (not on disabled queries)", () => {
    expect(PAGE.includes("fetchStatus === \"fetching\"")).toBe(true);
    expect(PAGE.includes("showSkeleton")).toBe(true);
  });
  it("honors auth-loading as a valid skeleton reason", () => {
    expect(PAGE.includes("authLoading")).toBe(true);
  });
  it("renders orders-empty and orders-error test ids", () => {
    expect(PAGE.includes('data-testid="orders-empty"')).toBe(true);
    expect(PAGE.includes('data-testid="orders-error"')).toBe(true);
  });
});

describe("useMyOrders enablement", () => {
  it("waits for auth to resolve before enabling the query", () => {
    expect(HOOK.includes("!authLoading && !!user")).toBe(true);
  });
});

describe("Historical purchases contract", () => {
  it("loads the caller's legacy rows through an authenticated self-only query", () => {
    expect(LEGACY_HOOK.includes('.from("transactions")')).toBe(true);
    expect(LEGACY_HOOK.includes('.eq("user_id", user.id)')).toBe(true);
    expect(LEGACY_HOOK.includes("!authLoading && !!user")).toBe(true);
  });

  it("separates historical purchases from V2 orders", () => {
    expect(PAGE.includes('data-testid="legacy-orders-list"')).toBe(true);
    expect(PAGE.includes("Historical purchases")).toBe(true);
    expect(PAGE.includes("Reconstructed value")).toBe(true);
  });
});

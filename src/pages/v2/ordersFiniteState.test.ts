/**
 * Finite-state contract tests for the V2 orders surface. Guards against the
 * "permanent skeleton" bug where an authenticated account with no orders
 * never settled to the empty state.
 */
import { describe, it, expect } from "bun:test";
import { parseMyOrdersPayload } from "../../hooks/v2/parseMyOrdersPayload";

declare const require: (m: string) => any;
const { readFileSync } = require("fs");
const { resolve } = require("path");

const HERE: string =
  (import.meta as unknown as { dir?: string }).dir ?? ".";
const PAGE: string = readFileSync(resolve(HERE, "./V2OrdersPage.tsx"), "utf8");
const HOOK: string = readFileSync(
  resolve(HERE, "../../hooks/v2/useMyOrders.ts"),
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
    expect(parseMyOrdersPayload({ ok: true, orders: [{ id: "1" } as any] }).length).toBe(1);
    expect(parseMyOrdersPayload({ orders: [{ id: "2" } as any] }).length).toBe(1);
  });
  it("passes through raw arrays", () => {
    expect(parseMyOrdersPayload([{ id: "3" } as any]).length).toBe(1);
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

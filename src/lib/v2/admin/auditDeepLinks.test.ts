import { describe, it, expect } from "bun:test";

// Polyfill localStorage before importing anything that transitively pulls in
// the Supabase browser client.
if (typeof (globalThis as { localStorage?: unknown }).localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage;
}

const { resolveEntityLink, shortId } = await import("@/lib/v2/admin/auditDeepLinks");
const { serializeAuditParams } = await import("@/hooks/admin/v2/useAdminAuditLog");

describe("resolveEntityLink", () => {
  it("returns null for missing type or id", () => {
    expect(resolveEntityLink(null, "x")).toBeNull();
    expect(resolveEntityLink("order", null)).toBeNull();
    expect(resolveEntityLink("", "")).toBeNull();
  });
  it("resolves known entity types to admin routes", () => {
    expect(resolveEntityLink("report", "r1")).toBe("/admin/operations?tab=reports&open=r1");
    expect(resolveEntityLink("order", "o1")).toBe("/admin/commerce?tab=orders&open=o1");
    expect(resolveEntityLink("refund", "rf1")).toBe("/admin/commerce?tab=refunds&open=rf1");
    expect(resolveEntityLink("discount", "d1")).toBe("/admin/commerce?tab=discounts&open=d1");
    expect(resolveEntityLink("discount_code", "d2")).toBe("/admin/commerce?tab=discounts&open=d2");
    expect(resolveEntityLink("resource", "res1")).toBe("/admin/content?tab=versions&resource=res1");
    expect(resolveEntityLink("resource_version", "v1")).toBe("/admin/content?tab=versions&version=v1");
    expect(resolveEntityLink("package_scan", "s1")).toBe("/admin/operations?tab=scans&open=s1");
    expect(resolveEntityLink("user", "u1")).toBe("/admin/people?tab=users&open=u1");
  });
  it("returns null for unknown types", () => {
    expect(resolveEntityLink("mystery", "x")).toBeNull();
  });
  it("uri-encodes ids with special chars", () => {
    expect(resolveEntityLink("order", "a b")).toBe("/admin/commerce?tab=orders&open=a%20b");
  });
});

describe("shortId", () => {
  it("handles null/undefined", () => {
    expect(shortId(null)).toBe("—");
    expect(shortId(undefined)).toBe("—");
  });
  it("takes first 8 chars", () => {
    expect(shortId("0123456789abcdef")).toBe("01234567");
  });
});

describe("serializeAuditParams", () => {
  it("returns nulls for empty inputs", () => {
    const r = serializeAuditParams({});
    expect(r.p_actor_types).toBeNull();
    expect(r.p_entity_types).toBeNull();
    expect(r.p_actions).toBeNull();
    expect(r.p_actor_user_id).toBeNull();
    expect(r.p_entity_id).toBeNull();
    expect(r.p_search).toBeNull();
    expect(r.p_from).toBeNull();
    expect(r.p_to).toBeNull();
    expect(r.p_limit).toBe(50);
    expect(r.p_offset).toBe(0);
  });
  it("collapses empty arrays to null", () => {
    const r = serializeAuditParams({ actorTypes: [], entityTypes: [], actions: [] });
    expect(r.p_actor_types).toBeNull();
    expect(r.p_entity_types).toBeNull();
    expect(r.p_actions).toBeNull();
  });
  it("passes through non-empty arrays", () => {
    const r = serializeAuditParams({ actorTypes: ["admin"], actions: ["order.paid"] });
    expect(r.p_actor_types).toEqual(["admin"]);
    expect(r.p_actions).toEqual(["order.paid"]);
  });
  it("trims and nulls whitespace search", () => {
    expect(serializeAuditParams({ search: "   " }).p_search).toBeNull();
    expect(serializeAuditParams({ search: "  hi " }).p_search).toBe("hi");
  });
  it("honors explicit limit/offset", () => {
    const r = serializeAuditParams({ limit: 10, offset: 20 });
    expect(r.p_limit).toBe(10);
    expect(r.p_offset).toBe(20);
  });
});

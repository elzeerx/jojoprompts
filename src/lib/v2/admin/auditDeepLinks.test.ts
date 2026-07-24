import { describe, it, expect } from "bun:test";
import { resolveEntityLink, shortId } from "@/lib/v2/admin/auditDeepLinks";
import { serializeAuditParams } from "@/hooks/admin/v2/useAdminAuditLog";

describe("resolveEntityLink", () => {
  it("returns null for missing type or id", () => {
    expect(resolveEntityLink(null, "x")).toBeNull();
    expect(resolveEntityLink("order", null)).toBeNull();
    expect(resolveEntityLink("", "")).toBeNull();
  });
  it("resolves known entity types to admin routes", () => {
    expect(resolveEntityLink("report", "r1")).toBe("/admin/trust/reports?open=r1");
    expect(resolveEntityLink("order", "o1")).toBe("/admin/orders?open=o1");
    expect(resolveEntityLink("refund", "rf1")).toBe("/admin/orders/refunds?open=rf1");
    expect(resolveEntityLink("discount", "d1")).toBe("/admin/orders/discounts?open=d1");
    expect(resolveEntityLink("discount_code", "d2")).toBe("/admin/orders/discounts?open=d2");
    expect(resolveEntityLink("resource", "res1")).toBe("/admin/publishing/versions?resource=res1");
    expect(resolveEntityLink("resource_version", "v1")).toBe("/admin/publishing/versions?version=v1");
    expect(resolveEntityLink("package_scan", "s1")).toBe("/admin/trust/scans?open=s1");
    expect(resolveEntityLink("user", "u1")).toBe("/admin/users?open=u1");
  });
  it("returns null for unknown types", () => {
    expect(resolveEntityLink("mystery", "x")).toBeNull();
  });
  it("uri-encodes ids with special chars", () => {
    expect(resolveEntityLink("order", "a b")).toBe("/admin/orders?open=a%20b");
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

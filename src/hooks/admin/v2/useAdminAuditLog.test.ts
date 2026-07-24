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

// Force a deterministic non-UTC local timezone for these tests.
(globalThis as { process?: { env: Record<string, string | undefined> } }).process!.env.TZ =
  "Asia/Kuwait"; // UTC+03:00, no DST

// Use dynamic import so the polyfill above runs first — static imports would
// hoist and evaluate the Supabase client before localStorage exists.
const { normalizeAuditDatetimeToUtcIso, serializeAuditParams } = await import(
  "./useAdminAuditLog"
);

describe("normalizeAuditDatetimeToUtcIso", () => {
  it("returns null for null/empty/whitespace", () => {
    expect(normalizeAuditDatetimeToUtcIso(null)).toBeNull();
    expect(normalizeAuditDatetimeToUtcIso(undefined)).toBeNull();
    expect(normalizeAuditDatetimeToUtcIso("")).toBeNull();
    expect(normalizeAuditDatetimeToUtcIso("   ")).toBeNull();
  });

  it("interprets naive datetime-local as local (TZ=Asia/Kuwait UTC+3)", () => {
    // 14:30 local in +03:00 == 11:30Z
    expect(normalizeAuditDatetimeToUtcIso("2026-07-24T14:30")).toBe(
      "2026-07-24T11:30:00.000Z",
    );
    expect(normalizeAuditDatetimeToUtcIso("2026-07-24T14:30:15")).toBe(
      "2026-07-24T11:30:15.000Z",
    );
  });

  it("passes through explicit-offset UTC ('Z')", () => {
    expect(normalizeAuditDatetimeToUtcIso("2026-07-24T11:30:00Z")).toBe(
      "2026-07-24T11:30:00.000Z",
    );
  });

  it("converts explicit-offset non-UTC to UTC ISO", () => {
    expect(normalizeAuditDatetimeToUtcIso("2026-07-24T14:30:00+03:00")).toBe(
      "2026-07-24T11:30:00.000Z",
    );
  });

  it("returns null for unparseable garbage (fail-closed)", () => {
    expect(normalizeAuditDatetimeToUtcIso("not-a-date")).toBeNull();
    expect(normalizeAuditDatetimeToUtcIso("2026/07/24 14:30")).toBeNull();
  });
});

describe("serializeAuditParams", () => {
  it("normalizes p_from and p_to and preserves nulls", () => {
    const out = serializeAuditParams({
      from: "2026-07-24T14:30",
      to: null,
      actorTypes: [],
      entityTypes: null,
    });
    expect(out.p_from).toBe("2026-07-24T11:30:00.000Z");
    expect(out.p_to).toBeNull();
    expect(out.p_actor_types).toBeNull();
    expect(out.p_entity_types).toBeNull();
  });

  it("respects already-UTC input", () => {
    const out = serializeAuditParams({ from: "2026-07-24T11:30:00Z" });
    expect(out.p_from).toBe("2026-07-24T11:30:00.000Z");
  });
});

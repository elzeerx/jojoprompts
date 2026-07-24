import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  normalizeAuditDatetimeToUtcIso,
  serializeAuditParams,
} from "./useAdminAuditLog";

// Force a deterministic non-UTC local timezone for tests below.
// Node honors the TZ env var for Date computations.
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "Asia/Kuwait"; // UTC+03:00, no DST
});
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ;
});

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
    // With seconds
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

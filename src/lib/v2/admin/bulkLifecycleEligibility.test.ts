import { describe, it, expect } from "bun:test";
import { computeBulkEligibility, hasAnyEligible } from "./bulkLifecycleEligibility";

const rows = [
  { id: "d1", lifecycle: "draft" as const },
  { id: "d2", lifecycle: "draft" as const },
  { id: "r1", lifecycle: "review" as const },
  { id: "p1", lifecycle: "published" as const },
  { id: "a1", lifecycle: "archived" as const },
];

describe("computeBulkEligibility", () => {
  it("splits selection into eligible vs skipped for archive", () => {
    const e = computeBulkEligibility(["d1","r1","p1","a1"], rows, "archive");
    expect(e.eligibleIds.sort()).toEqual(["d1","p1","r1"]);
    expect(e.skippedIds).toEqual(["a1"]);
    expect(e.totalSelected).toBe(4);
  });

  it("restore only accepts archived rows", () => {
    const e = computeBulkEligibility(["d1","r1","p1","a1"], rows, "restore");
    expect(e.eligibleIds).toEqual(["a1"]);
    expect(e.skippedCount).toBe(3);
  });

  it("publish accepts draft or review but not published or archived", () => {
    const e = computeBulkEligibility(["d1","r1","p1","a1"], rows, "publish");
    expect(e.eligibleIds.sort()).toEqual(["d1","r1"]);
  });

  it("review accepts only draft", () => {
    const e = computeBulkEligibility(["d1","d2","r1","p1","a1"], rows, "review");
    expect(e.eligibleIds.sort()).toEqual(["d1","d2"]);
  });

  it("hasAnyEligible returns false for all-invalid selection", () => {
    expect(hasAnyEligible(["a1"], rows, "publish")).toBe(false);
    expect(hasAnyEligible(["p1"], rows, "restore")).toBe(false);
  });

  it("ignores unknown IDs (not in visible rows) as skipped", () => {
    const e = computeBulkEligibility(["ghost"], rows, "archive");
    expect(e.eligibleCount).toBe(0);
    expect(e.skippedIds).toEqual(["ghost"]);
  });
});

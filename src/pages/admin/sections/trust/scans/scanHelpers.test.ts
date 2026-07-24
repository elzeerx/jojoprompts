import { describe, it, expect } from "bun:test";
import {
  attentionCount,
  isAttentionState,
  statusLabel,
  statusTone,
  formatBytes,
  formatFindings,
  clampPage,
  totalPagesFor,
} from "./scanHelpers";

describe("scanHelpers", () => {
  it("attentionCount sums malicious+suspicious+failed only", () => {
    expect(
      attentionCount({
        total_with_files: 10,
        unscanned: 2,
        pending: 1,
        clean: 3,
        suspicious: 1,
        malicious: 2,
        failed: 1,
      }),
    ).toBe(4);
    expect(attentionCount(null)).toBe(0);
  });

  it("isAttentionState reflects the attention set", () => {
    expect(isAttentionState("malicious")).toBe(true);
    expect(isAttentionState("suspicious")).toBe(true);
    expect(isAttentionState("failed")).toBe(true);
    expect(isAttentionState("clean")).toBe(false);
    expect(isAttentionState("pending")).toBe(false);
    expect(isAttentionState("unscanned")).toBe(false);
  });

  it("statusLabel and statusTone map every state", () => {
    for (const s of [
      "unscanned",
      "pending",
      "clean",
      "suspicious",
      "malicious",
      "failed",
    ] as const) {
      expect(statusLabel(s).length).toBeGreaterThan(0);
      expect(["default", "secondary", "destructive", "outline"]).toContain(
        statusTone(s),
      );
    }
    expect(statusTone("clean")).toBe("secondary");
    expect(statusTone("pending")).toBe("default");
    expect(statusTone("malicious")).toBe("destructive");
    expect(statusTone("unscanned")).toBe("outline");
  });

  it("formatBytes handles null and unit ranges", () => {
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(undefined)).toBe("—");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formatFindings produces safe JSON strings", () => {
    expect(formatFindings(null)).toBe("{}");
    expect(formatFindings({ a: 1 })).toContain("\"a\": 1");
    const circ: { self?: unknown } = {};
    circ.self = circ;
    expect(formatFindings(circ)).toBe("{}");
  });

  it("clampPage and totalPagesFor are safe", () => {
    expect(totalPagesFor(0, 50)).toBe(1);
    expect(totalPagesFor(100, 50)).toBe(2);
    expect(totalPagesFor(101, 50)).toBe(3);
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(2, 3)).toBe(2);
    expect(clampPage(99, 3)).toBe(3);
    expect(clampPage(Number.NaN, 3)).toBe(1);
  });
});

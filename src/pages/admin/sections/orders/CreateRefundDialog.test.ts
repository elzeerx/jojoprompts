import { describe, expect, test } from "bun:test";
import { formatRefundableLoadError } from "./CreateRefundDialog";

describe("formatRefundableLoadError", () => {
  test("null/undefined returns generic message", () => {
    expect(formatRefundableLoadError(null)).toBe("Failed to load order");
    expect(formatRefundableLoadError(undefined)).toBe("Failed to load order");
  });

  test("includes code and message when present", () => {
    const err = { code: "PGRST116", message: "no rows" };
    expect(formatRefundableLoadError(err)).toBe("Failed to load order (PGRST116): no rows");
  });

  test("falls back to message-only when no code", () => {
    expect(formatRefundableLoadError({ message: "boom" })).toBe("Failed to load order: boom");
  });

  test("truncates very long messages", () => {
    const long = "x".repeat(500);
    const out = formatRefundableLoadError({ message: long });
    expect(out.endsWith("…")).toBe(true);
    expect(out.length < 230).toBe(true);
  });

  test("rejects absurdly long code fields", () => {
    const err = { code: "x".repeat(50), message: "hi" };
    expect(formatRefundableLoadError(err)).toBe("Failed to load order: hi");
  });
});

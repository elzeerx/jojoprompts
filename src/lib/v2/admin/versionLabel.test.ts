import { describe, it, expect } from "bun:test";
import { formatVersionLabel } from "./versionLabel";

describe("formatVersionLabel", () => {
  it("renders the stored semantic version exactly once", () => {
    expect(formatVersionLabel("1.0.0", 1)).toBe("v1.0.0");
  });

  it("does not concatenate major_version when version is present", () => {
    expect(formatVersionLabel("2.3.1", 5)).toBe("v2.3.1");
  });

  it("falls back to major_version when version is missing", () => {
    expect(formatVersionLabel(null, 3)).toBe("v3");
    expect(formatVersionLabel(undefined, 0)).toBe("v0");
    expect(formatVersionLabel("   ", 2)).toBe("v2");
  });

  it("returns null when neither is available", () => {
    expect(formatVersionLabel(null, null)).toBeNull();
    expect(formatVersionLabel(undefined, undefined)).toBeNull();
    expect(formatVersionLabel("", null)).toBeNull();
  });
});

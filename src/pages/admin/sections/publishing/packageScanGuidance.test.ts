import { describe, it, expect } from "bun:test";
import { packageScanGuidance } from "./packageScanGuidance";

describe("packageScanGuidance — exhaustive state → guidance mapping", () => {
  it("clean: positive; not blocked; never mentions 'pending' or 'blocked'", () => {
    const g = packageScanGuidance("clean");
    expect(g.badge).toBe("Clean");
    expect(g.tone).toBe("success");
    expect(g.blocksPublishing).toBe(false);
    expect(g.message.toLowerCase()).not.toContain("pending");
    expect(g.message.toLowerCase()).not.toContain("blocked");
    // Positive framing
    expect(/passed|proceed|publish/i.test(g.message)).toBe(true);
  });

  it("pending: scanning in progress; publishing blocked", () => {
    const g = packageScanGuidance("pending");
    expect(g.badge).toBe("Scan pending");
    expect(g.tone).toBe("info");
    expect(g.blocksPublishing).toBe(true);
    expect(/scan/i.test(g.message)).toBe(true);
    expect(/blocked/i.test(g.message)).toBe(true);
  });

  it("suspicious: manual review; blocked", () => {
    const g = packageScanGuidance("suspicious");
    expect(g.tone).toBe("warning");
    expect(g.blocksPublishing).toBe(true);
    expect(/manual/i.test(g.message)).toBe(true);
    expect(/blocked/i.test(g.message)).toBe(true);
  });

  it("malicious: replace file; blocked", () => {
    const g = packageScanGuidance("malicious");
    expect(g.tone).toBe("danger");
    expect(g.blocksPublishing).toBe(true);
    expect(/replace/i.test(g.message)).toBe(true);
  });

  it("failed: retry from Package Scans; blocked", () => {
    const g = packageScanGuidance("failed");
    expect(g.tone).toBe("danger");
    expect(g.blocksPublishing).toBe(true);
    expect(/retry|Package Scans/i.test(g.message)).toBe(true);
  });

  it("null (no scan row): explains no scan yet; blocked", () => {
    const g = packageScanGuidance(null);
    expect(g.badge).toBe("No scan yet");
    expect(g.tone).toBe("info");
    expect(g.blocksPublishing).toBe(true);
    expect(/no scan/i.test(g.message)).toBe(true);
    expect(/blocked/i.test(g.message)).toBe(true);
  });

  it("undefined behaves the same as null", () => {
    expect(packageScanGuidance(undefined)).toEqual(packageScanGuidance(null));
  });

  it("badge and message never disagree with blocksPublishing on the clean branch", () => {
    // Regression: previously the alert said 'Scan pending; publishing remains blocked'
    // even when the badge showed 'Clean'. Ensure such a combination is impossible.
    const g = packageScanGuidance("clean");
    expect(g.blocksPublishing).toBe(false);
    expect(g.badge).not.toMatch(/pending|blocked/i);
  });
});

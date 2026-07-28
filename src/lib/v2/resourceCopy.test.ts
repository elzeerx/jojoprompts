import { describe, expect, it } from "bun:test";
import { withoutAcquisitionInstruction } from "./resourceCopy";

describe("withoutAcquisitionInstruction", () => {
  it("removes the imported English acquisition sentence for owned views", () => {
    expect(
      withoutAcquisitionInstruction(
        "A useful image style. Acquire it to unlock the complete prompt.",
      ),
    ).toBe("A useful image style.");
  });

  it("removes the matching Arabic acquisition sentence", () => {
    expect(
      withoutAcquisitionInstruction(
        "نمط صور مفيد. احصل عليه لفتح البرومبت الكامل.",
      ),
    ).toBe("نمط صور مفيد.");
  });

  it("preserves ordinary summaries and handles empty input", () => {
    expect(withoutAcquisitionInstruction("A useful skill.")).toBe("A useful skill.");
    expect(withoutAcquisitionInstruction(null)).toBeNull();
  });
});

import { describe, expect, it } from "bun:test";
import {
  isDefaultTextPromptImage,
  normalizeStorageObjectPath,
} from "@/utils/storageImagePath";

describe("legacy Storage image paths", () => {
  it("decodes encoded spaces exactly once", () => {
    expect(normalizeStorageObjectPath("cards/ChatGPT%20Prompt%20Redbull.png"))
      .toBe("cards/ChatGPT Prompt Redbull.png");
    expect(normalizeStorageObjectPath("cards/already%2520encoded.png"))
      .toBe("cards/already%20encoded.png");
  });

  it("preserves literal spaces and removes legacy leading slashes", () => {
    expect(normalizeStorageObjectPath("/cards/collectable cards.png"))
      .toBe("cards/collectable cards.png");
  });

  it("rejects traversal and control characters", () => {
    expect(normalizeStorageObjectPath("cards/../secret.png")).toBeNull();
    expect(normalizeStorageObjectPath("cards/%2e%2e/secret.png")).toBeNull();
    expect(normalizeStorageObjectPath("cards/bad%00name.png")).toBeNull();
  });

  it("routes only the default prompt image to its dedicated bucket", () => {
    expect(isDefaultTextPromptImage("textpromptdefaultimg.jpg")).toBe(true);
    expect(isDefaultTextPromptImage("cards/textpromptdefaultimg.jpg")).toBe(false);
  });
});

import { describe, it, expect } from "bun:test";
import { generateUuidV4, UUID_V4_REGEX } from "./uuid";

describe("generateUuidV4", () => {
  it("produces a canonical RFC 4122 v4 uuid", () => {
    for (let i = 0; i < 50; i++) {
      const id = generateUuidV4();
      expect(UUID_V4_REGEX.test(id)).toBe(true);
    }
  });

  it("generates unique values", () => {
    const set = new Set<string>();
    for (let i = 0; i < 200; i++) set.add(generateUuidV4());
    expect(set.size).toBe(200);
  });

  it("never produces the old buggy fallback shape", () => {
    for (let i = 0; i < 20; i++) {
      const id = generateUuidV4();
      // Old fallback was `${Date.now()}-${Math.random().toString(16).slice(2)}`.
      expect(/^\d{10,}-/.test(id)).toBe(false);
    }
  });
});

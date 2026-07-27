import { describe, it, expect } from "bun:test";
import {
  pickProtectedText,
  shouldRevealProtectedContent,
} from "./protectedContentDisplay";

describe("pickProtectedText", () => {
  it("returns null when content is missing or not ok", () => {
    expect(pickProtectedText(null, "en")).toBeNull();
    expect(pickProtectedText(undefined, "en")).toBeNull();
    expect(pickProtectedText({ ok: false, prompt_text: "x" }, "en")).toBeNull();
    expect(pickProtectedText({ ok: false }, "ar")).toBeNull();
  });

  it("prefers the requested language when present", () => {
    expect(
      pickProtectedText({ ok: true, prompt_text: "hello", prompt_text_ar: "مرحبا" }, "en"),
    ).toBe("hello");
    expect(
      pickProtectedText({ ok: true, prompt_text: "hello", prompt_text_ar: "مرحبا" }, "ar"),
    ).toBe("مرحبا");
  });

  it("falls back to the other language when requested is empty/null", () => {
    expect(
      pickProtectedText({ ok: true, prompt_text: null, prompt_text_ar: "مرحبا" }, "en"),
    ).toBe("مرحبا");
    expect(
      pickProtectedText({ ok: true, prompt_text: "hello", prompt_text_ar: "" }, "ar"),
    ).toBe("hello");
  });

  it("returns null when both languages are empty", () => {
    expect(
      pickProtectedText({ ok: true, prompt_text: "", prompt_text_ar: null }, "en"),
    ).toBeNull();
    expect(
      pickProtectedText({ ok: true, prompt_text: null, prompt_text_ar: null }, "ar"),
    ).toBeNull();
  });
});

describe("shouldRevealProtectedContent", () => {
  it("requires all three signals to be truthy", () => {
    expect(
      shouldRevealProtectedContent({ hasUser: true, owned: true, legacyPromptId: "p1" }),
    ).toBe(true);
  });

  it("fails closed when any signal is missing", () => {
    expect(
      shouldRevealProtectedContent({ hasUser: false, owned: true, legacyPromptId: "p1" }),
    ).toBe(false);
    expect(
      shouldRevealProtectedContent({ hasUser: true, owned: false, legacyPromptId: "p1" }),
    ).toBe(false);
    expect(
      shouldRevealProtectedContent({ hasUser: true, owned: true, legacyPromptId: null }),
    ).toBe(false);
    expect(
      shouldRevealProtectedContent({ hasUser: true, owned: true, legacyPromptId: "" }),
    ).toBe(false);
    expect(
      shouldRevealProtectedContent({ hasUser: true, owned: true, legacyPromptId: undefined }),
    ).toBe(false);
  });
});

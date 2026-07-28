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
  it("allows signed-in owners of inline-delivery resource types", () => {
    expect(
      shouldRevealProtectedContent({ hasUser: true, owned: true, resourceType: "prompt" }),
    ).toBe(true);
    expect(
      shouldRevealProtectedContent({ hasUser: true, owned: true, resourceType: "prompt_pack" }),
    ).toBe(true);
    expect(
      shouldRevealProtectedContent({ hasUser: true, owned: true, resourceType: "image_style" }),
    ).toBe(true);
    expect(
      shouldRevealProtectedContent({ hasUser: true, owned: true, resourceType: "automation" }),
    ).toBe(true);
    expect(
      shouldRevealProtectedContent({ hasUser: true, owned: true, resourceType: "skill" }),
    ).toBe(true);
  });

  it("fails closed for anonymous, unowned, bundle, or unknown resources", () => {
    expect(
      shouldRevealProtectedContent({ hasUser: false, owned: true, resourceType: "prompt" }),
    ).toBe(false);
    expect(
      shouldRevealProtectedContent({ hasUser: true, owned: false, resourceType: "prompt" }),
    ).toBe(false);
    expect(
      shouldRevealProtectedContent({ hasUser: true, owned: true, resourceType: "bundle" }),
    ).toBe(false);
    expect(
      shouldRevealProtectedContent({ hasUser: true, owned: true, resourceType: undefined }),
    ).toBe(false);
  });
});

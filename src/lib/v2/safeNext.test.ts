import { describe, it, expect } from "bun:test";
import { resolveSafeNext, readSafeNextParam, DEFAULT_SAFE_NEXT } from "./safeNext";

describe("resolveSafeNext", () => {
  it("returns the fallback for empty / non-string input", () => {
    expect(resolveSafeNext(undefined)).toBe(DEFAULT_SAFE_NEXT);
    expect(resolveSafeNext(null)).toBe(DEFAULT_SAFE_NEXT);
    expect(resolveSafeNext("")).toBe(DEFAULT_SAFE_NEXT);
    expect(resolveSafeNext("   ")).toBe(DEFAULT_SAFE_NEXT);
    expect(resolveSafeNext(42 as unknown)).toBe(DEFAULT_SAFE_NEXT);
  });

  it("accepts representative internal V2 destinations with query strings", () => {
    for (const p of [
      "/explore",
      "/checkout",
      "/cart",
      "/library",
      "/orders",
      "/account",
      "/resources/some-slug",
      "/resources/some-slug?ref=email",
      "/checkout?intent=lifetime",
      "/how-it-works",
      "/pricing",
    ]) {
      expect(resolveSafeNext(p)).toBe(p);
    }
  });

  it("rejects external, protocol-relative, backslash and scheme-bearing values", () => {
    for (const p of [
      "https://evil.com/x",
      "http://evil.com",
      "//evil.com/x",
      "/\\evil.com",
      "\\\\evil.com",
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "mailto:x@y.z",
      "ftp://x/y",
    ]) {
      expect(resolveSafeNext(p)).toBe(DEFAULT_SAFE_NEXT);
    }
  });

  it("rejects login/reset/signup loop destinations", () => {
    for (const p of [
      "/login",
      "/login?next=/x",
      "/signup",
      "/signup?plan=pro",
      "/reset-password",
      "/reset-password?token=abc",
      "/email-confirmation",
      "/magic-link-sent",
      "/auth/verify-email",
      "/auth/callback",
    ]) {
      expect(resolveSafeNext(p)).toBe(DEFAULT_SAFE_NEXT);
    }
  });

  it("rejects bare '/'", () => {
    expect(resolveSafeNext("/")).toBe(DEFAULT_SAFE_NEXT);
  });

  it("honors an explicit fallback override", () => {
    expect(resolveSafeNext(undefined, "/library")).toBe("/library");
    expect(resolveSafeNext("//evil", "/library")).toBe("/library");
  });

  it("rejects embedded control chars / CRLF / whitespace (smuggling)", () => {
    for (const p of [
      "/explore\n",
      "/explore\r\nSet-Cookie:x=1",
      "/exp lore",
      "/explore\t",
      "/explore\u0000",
      "/explore\u007F",
    ]) {
      expect(resolveSafeNext(p)).toBe(DEFAULT_SAFE_NEXT);
    }
  });

  it("URLSearchParams-decoded backslash/scheme still rejected", () => {
    // %5C -> "\", %2F -> "/", %3A -> ":" once URLSearchParams.get decodes.
    const sp = new URLSearchParams(
      "a=/%5Cevil.com&b=%2F%2Fevil.com&c=javascript%3Aalert(1)",
    );
    expect(resolveSafeNext(sp.get("a"))).toBe(DEFAULT_SAFE_NEXT);
    expect(resolveSafeNext(sp.get("b"))).toBe(DEFAULT_SAFE_NEXT);
    expect(resolveSafeNext(sp.get("c"))).toBe(DEFAULT_SAFE_NEXT);
  });

  it("rejects backslash smuggling anywhere in the value", () => {
    for (const p of [
      "/foo\\bar",
      "/\\evil.com",
      "\\/evil.com",
      "\\\\evil.com",
      "/legit?next=/ok\\bad",
    ]) {
      expect(resolveSafeNext(p)).toBe(DEFAULT_SAFE_NEXT);
    }
  });

  it("rejects nested auth-loop next= smuggled through the query", () => {
    for (const p of [
      "/checkout?next=/login",
      "/library?foo=1&next=/signup",
      "/orders?next=/reset-password",
      "/x#next=/auth/callback",
      "/y?next=/magic-link-sent",
    ]) {
      expect(resolveSafeNext(p)).toBe(DEFAULT_SAFE_NEXT);
    }
  });

  it("preserves legitimate V2 relative query strings", () => {
    for (const p of [
      "/checkout?intent=lifetime",
      "/resources/foo?ref=email",
      "/orders?page=2&sort=recent",
    ]) {
      expect(resolveSafeNext(p)).toBe(p);
    }
  });

  it("rejects raw leading/trailing whitespace (does NOT auto-trim)", () => {
    // Rationale: the URL layer is authoritative; if callers pass a padded
    // value we treat it as tampered rather than silently normalizing.
    for (const p of [
      " /explore",
      "/explore ",
      "\t/explore",
      "/explore\t",
      "\n/explore",
      "/explore\n",
      "\r\n/explore",
      "  /library  ",
    ]) {
      expect(resolveSafeNext(p)).toBe(DEFAULT_SAFE_NEXT);
    }
  });

  it("recursively rejects percent-encoded nested auth-loops in next=", () => {
    // Once-encoded: %2F=/, %3D==, %3F=? — URLSearchParams decodes this
    // exactly once, so the inner value becomes `/login?next=%2Flogin`.
    // Our recursive resolver then inspects that decoded inner value.
    for (const p of [
      "/account?next=%2Flogin",
      "/account?next=%2Flogin%3Fnext%3D%252Flogin",
      "/account?next=%2Fsignup",
      "/x?next=%2Fauth%2Fcallback",
      "/y#next=%2Freset-password",
    ]) {
      expect(resolveSafeNext(p)).toBe(DEFAULT_SAFE_NEXT);
    }
  });

  it("recursively rejects percent-encoded nested external/protocol-relative next=", () => {
    for (const p of [
      "/account?next=%2F%2Fevil.com",
      "/account?next=https%3A%2F%2Fevil.com",
      "/account?next=javascript%3Aalert(1)",
      "/account?next=%5C%5Cevil.com",
      "/account?next=%2Ffoo%00bar",
    ]) {
      expect(resolveSafeNext(p)).toBe(DEFAULT_SAFE_NEXT);
    }
  });

  it("permits legitimate nested internal next values", () => {
    for (const p of [
      "/account?next=%2Flibrary",
      "/account?next=%2Fcheckout%3Fintent%3Dlifetime",
      "/orders?next=%2Fresources%2Fabc",
    ]) {
      expect(resolveSafeNext(p)).toBe(p);
    }
  });

  it("bounded recursion / cycle protection falls back on adversarial nesting", () => {
    // 6 levels of encoded /account?next= — exceeds MAX_NESTED_DEPTH (4).
    // Even though each level is internally shaped like /account, we refuse
    // to keep unwrapping and fall back rather than accept.
    let inner = "/login"; // final payload is an auth-loop
    for (let i = 0; i < 6; i++) {
      inner = `/account?next=${encodeURIComponent(inner)}`;
    }
    expect(resolveSafeNext(inner)).toBe(DEFAULT_SAFE_NEXT);
  });
});

describe("readSafeNextParam", () => {
  it("reads `next` from URLSearchParams-like objects", () => {
    const sp = new URLSearchParams("next=/checkout%3Fintent%3Dlifetime");
    expect(readSafeNextParam(sp)).toBe("/checkout?intent=lifetime");
  });

  it("falls back when params is missing or has no next", () => {
    expect(readSafeNextParam(null)).toBe(DEFAULT_SAFE_NEXT);
    expect(readSafeNextParam(new URLSearchParams(""))).toBe(DEFAULT_SAFE_NEXT);
  });
});

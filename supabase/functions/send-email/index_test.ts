// Pure/unit tests for send-email hardening. Do NOT spin the server or
// send real email.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  constantTimeEqual,
  normalizeEmail,
  hasOnlyAllowedKeys,
  hmacSha256Hex,
  escapeHtml,
} from "../_shared/emailCommon.ts";
import { validateTemplateSlug, validateVariables } from "./validation.ts";




Deno.test("constantTimeEqual: same string true", () => {
  assert(constantTimeEqual("abcdef", "abcdef"));
});
Deno.test("constantTimeEqual: different string false", () => {
  assert(!constantTimeEqual("abcdef", "abcdez"));
});
Deno.test("constantTimeEqual: different length false", () => {
  assert(!constantTimeEqual("a", "ab"));
});
Deno.test("constantTimeEqual: non-string false", () => {
  // deno-lint-ignore no-explicit-any
  assert(!constantTimeEqual(null as any, "x"));
});

Deno.test("normalizeEmail lowercases and trims", () => {
  assertEquals(normalizeEmail(" Hello@Example.COM "), "hello@example.com");
});
Deno.test("normalizeEmail rejects garbage", () => {
  assertEquals(normalizeEmail("no-at"), null);
  assertEquals(normalizeEmail("a@b"), null);
  assertEquals(normalizeEmail("a b@c.com"), null);
  assertEquals(normalizeEmail(""), null);
  assertEquals(normalizeEmail(null), null);
});

Deno.test("hasOnlyAllowedKeys strict allowlist", () => {
  assert(hasOnlyAllowedKeys({ to: "x" }, ["to"] as const));
  assert(!hasOnlyAllowedKeys({ to: "x", drop: 1 } as any, ["to"] as const));
});

Deno.test("validateTemplateSlug shape", () => {
  assert(validateTemplateSlug("v2_order_receipt"));
  assert(validateTemplateSlug("payment.confirmation-1"));
  assert(!validateTemplateSlug(""));
  assert(!validateTemplateSlug("has space"));
  assert(!validateTemplateSlug("UPPER"));
  assert(!validateTemplateSlug("a".repeat(81)));
});

Deno.test("validateVariables limits", () => {
  assert(validateVariables(undefined));
  assert(validateVariables({}));
  assert(validateVariables({ a: 1, b: "x" }));
  assert(!validateVariables("string" as unknown));
  const wide: Record<string, number> = {};
  for (let i = 0; i < 21; i++) wide["k" + i] = i;
  assert(!validateVariables(wide));
  assert(!validateVariables({ big: "x".repeat(9000) }));
});

Deno.test("escapeHtml handles all sensitive chars", () => {
  assertEquals(escapeHtml(`<b>"&'</b>`), "&lt;b&gt;&quot;&amp;&#39;&lt;/b&gt;");
});

Deno.test("hmacSha256Hex deterministic and 64-char", async () => {
  const a = await hmacSha256Hex("k", "d");
  const b = await hmacSha256Hex("k", "d");
  assertEquals(a, b);
  assertEquals(a.length, 64);
  const c = await hmacSha256Hex("k2", "d");
  assert(a !== c);
});

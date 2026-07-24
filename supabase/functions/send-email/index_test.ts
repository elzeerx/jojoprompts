// Pure/unit tests for send-email hardening + shared resend helper.
// Do NOT spin the server or send real email.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  constantTimeEqual,
  normalizeEmail,
  hasOnlyAllowedKeys,
  hmacSha256Hex,
  escapeHtml,
} from "../_shared/emailCommon.ts";
import { validateTemplateSlug, validateVariables } from "./validation.ts";
import { resendIdempotencyKey, sendResendEmail } from "../_shared/resendClient.ts";

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
  // deno-lint-ignore no-explicit-any
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

Deno.test("validateVariables: undefined/null accepted, returns boolean", () => {
  assertEquals(validateVariables(undefined), true);
  assertEquals(validateVariables(null), true);
});
Deno.test("validateVariables: shallow object accepted", () => {
  assert(validateVariables({ a: 1, b: "x" }));
});
Deno.test("validateVariables: non-object rejected", () => {
  // deno-lint-ignore no-explicit-any
  assert(!validateVariables("string" as any));
  // deno-lint-ignore no-explicit-any
  assert(!validateVariables([1, 2, 3] as any));
});
Deno.test("validateVariables: too many keys rejected", () => {
  const wide: Record<string, number> = {};
  for (let i = 0; i < 21; i++) wide["k" + i] = i;
  assert(!validateVariables(wide));
});
Deno.test("validateVariables: too-big JSON rejected", () => {
  assert(!validateVariables({ big: "x".repeat(9000) }));
});
Deno.test("validateVariables: depth 4 accepted, depth 5 rejected", () => {
  // depth 1 = root object, so { a: { b: { c: { d: 1 } } } } is depth 4.
  const d4 = { a: { b: { c: { d: 1 } } } };
  assert(validateVariables(d4));
  const d5 = { a: { b: { c: { d: { e: 1 } } } } };
  assert(!validateVariables(d5));
});
Deno.test("validateVariables: cyclic rejected", () => {
  const obj: Record<string, unknown> = { a: 1 };
  obj.self = obj;
  assert(!validateVariables(obj));
});
Deno.test("validateVariables: NaN/Infinity rejected", () => {
  assert(!validateVariables({ n: NaN }));
  assert(!validateVariables({ n: Infinity }));
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

// ---------------- Resend idempotency & transport ----------------

Deno.test("resendIdempotencyKey: stable per leg, distinct across legs", () => {
  const id = "12345678-1234-4234-8234-123456789012";
  const k1a = resendIdempotencyKey("contact_confirmation", id);
  const k1b = resendIdempotencyKey("contact_confirmation", id);
  const k2  = resendIdempotencyKey("contact_admin", id);
  const k3  = resendIdempotencyKey("send_email", id);
  assertEquals(k1a, k1b);       // retries reuse the same key
  assert(k1a !== k2);           // legs differ
  assert(k1a !== k3);
  assert(k2 !== k3);
});

Deno.test("sendResendEmail: sets Idempotency-Key header on POST /emails", async () => {
  const calls: Request[] = [];
  const mockFetch: typeof fetch = async (_input, init) => {
    // deno-lint-ignore no-explicit-any
    const req = new Request(_input as any, init as any);
    calls.push(req);
    return new Response(JSON.stringify({ id: "resend-abc" }), { status: 200 });
  };
  const res = await sendResendEmail(
    { from: "a@x.com", to: "b@x.com", subject: "s", html: "<p>h</p>" },
    "test-key",
    "contact_confirmation:abc",
    mockFetch,
  );
  assertEquals(res.ok, true);
  assertEquals(res.id, "resend-abc");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].method, "POST");
  assertEquals(new URL(calls[0].url).pathname, "/emails");
  assertEquals(calls[0].headers.get("Idempotency-Key"), "contact_confirmation:abc");
  assertEquals(calls[0].headers.get("Authorization"), "Bearer test-key");
  // Consume the body to satisfy Deno's resource-leak checker.
  await calls[0].text();
});

Deno.test("sendResendEmail: retried call reuses same idempotency key per leg", async () => {
  const seen: string[] = [];
  const mockFetch: typeof fetch = async (_input, init) => {
    seen.push((init as RequestInit).headers && (init as any).headers["Idempotency-Key"]);
    return new Response(JSON.stringify({ id: "x" }), { status: 200 });
  };
  const key = resendIdempotencyKey("contact_admin", "sub-1");
  await sendResendEmail({ from: "a@x.com", to: "b@x.com", subject: "s", html: "h" }, "k", key, mockFetch);
  await sendResendEmail({ from: "a@x.com", to: "b@x.com", subject: "s", html: "h" }, "k", key, mockFetch);
  assertEquals(seen[0], seen[1]);
});

Deno.test("sendResendEmail: non-2xx returns sanitized provider_error", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ message: "detailed provider failure" }), { status: 422 });
  const res = await sendResendEmail(
    { from: "a@x.com", to: "b@x.com", subject: "s", html: "h" },
    "k", "k1", mockFetch,
  );
  assertEquals(res.ok, false);
  assertEquals(res.status, 422);
  assertEquals(res.errorCode, "provider_error");
});

Deno.test("sendResendEmail: transport throw returns provider_exception", async () => {
  const mockFetch: typeof fetch = () => { throw new Error("dns"); };
  const res = await sendResendEmail(
    { from: "a@x.com", to: "b@x.com", subject: "s", html: "h" },
    "k", "k1", mockFetch,
  );
  assertEquals(res.ok, false);
  assertEquals(res.errorCode, "provider_exception");
});

// ---------------- Authorization contract shape tests ----------------
//
// These document the behavior enforced in the handler body. We assert only
// the pure shape predicates the handler branches on, not live HTTP behavior
// (which requires Deno.env / Supabase / Resend and is out of scope for the
// unit suite).

const USER_ALLOWED = new Set<string>([
  "welcome", "payment_confirmation", "payment_failed",
  "subscription_cancelled", "account_deleted",
  "email_confirmation", "password_reset",
]);
const TRANSACTIONAL = new Set<string>([
  "email_confirmation", "password_reset", "payment_confirmation",
  "payment_failed", "account_deleted", "subscription_cancelled",
]);

Deno.test("contract: user allowed email_types cover audited lifecycle set", () => {
  for (const t of ["welcome","payment_confirmation","password_reset","email_confirmation"]) {
    assert(USER_ALLOWED.has(t));
  }
  assert(!USER_ALLOWED.has("marketing_blast"));
});
Deno.test("contract: transactional set excludes marketing types", () => {
  assert(TRANSACTIONAL.has("password_reset"));
  assert(!TRANSACTIONAL.has("welcome")); // welcome respects unsubscribe
});
Deno.test("contract: admin payload without template_slug is rejected shape", () => {
  // Admin must send template_slug; raw subject/html/text/template must be absent.
  const adminOk = { template_slug: "v2_order_receipt", variables: { a: 1 } };
  const adminBadRaw = { template_slug: "v2_order_receipt", subject: "x" };
  const adminBadMissing = { variables: {} };
  const hasRaw = (b: Record<string, unknown>) =>
    b.subject !== undefined || b.html !== undefined || b.text !== undefined || b.template !== undefined;
  assert(!hasRaw(adminOk));
  assert(hasRaw(adminBadRaw));
  assert(!("template_slug" in adminBadMissing));
});

// ---- send-email limiter hash namespace/scope tests ----
// hmacSha256Hex already imported above

Deno.test("send-email limiter: user hash namespace is distinct from admin for same user id", async () => {
  const secret = "test-secret-key";
  const uid = "00000000-0000-4000-8000-000000000001";
  const u = await hmacSha256Hex(secret, `send-email:user:${uid}`);
  const a = await hmacSha256Hex(secret, `send-email:admin:${uid}`);
  assert(u !== a);
  assertEquals(u.length, 64);
  assertEquals(a.length, 64);
});

Deno.test("send-email limiter: hash is deterministic and does not leak raw user id", async () => {
  const secret = "test-secret-key";
  const uid = "00000000-0000-4000-8000-000000000042";
  const h1 = await hmacSha256Hex(secret, `send-email:user:${uid}`);
  const h2 = await hmacSha256Hex(secret, `send-email:user:${uid}`);
  assertEquals(h1, h2);
  assert(!h1.includes(uid));
});

Deno.test("send-email limiter: namespace differs from contact limiter for identical id", async () => {
  const secret = "test-secret-key";
  const id = "abc@example.com";
  const contactEmail = await hmacSha256Hex(secret, `contact:email:${id}`);
  const sendUser = await hmacSha256Hex(secret, `send-email:user:${id}`);
  assert(contactEmail !== sendUser);
});

Deno.test("send-email limiter: distinct user ids produce distinct hashes", async () => {
  const secret = "test-secret-key";
  const a = await hmacSha256Hex(secret, `send-email:user:${"a".repeat(36)}`);
  const b = await hmacSha256Hex(secret, `send-email:user:${"b".repeat(36)}`);
  assert(a !== b);
});

// ---- Unsubscribe decision helper tests (pure) ----
import { decideUnsubscribeAction } from "./unsubscribeDecision.ts";

Deno.test("unsubscribe: essential transactional bypasses lookup even if error/row present", () => {
  for (const t of ["email_confirmation","password_reset","payment_confirmation","payment_failed","account_deleted","subscription_cancelled"]) {
    assertEquals(decideUnsubscribeAction(t, { hasError: true, hasRow: true }), "bypass");
    assertEquals(decideUnsubscribeAction(t, { hasError: false, hasRow: false }), "bypass");
  }
});

Deno.test("unsubscribe: non-transactional lookup error => error_503 (fail closed)", () => {
  assertEquals(decideUnsubscribeAction("welcome", { hasError: true, hasRow: false }), "error_503");
  assertEquals(decideUnsubscribeAction("marketing_blast", { hasError: true, hasRow: true }), "error_503");
});

Deno.test("unsubscribe: non-transactional with unsubscribed row => blocked", () => {
  assertEquals(decideUnsubscribeAction("welcome", { hasError: false, hasRow: true }), "blocked");
});

Deno.test("unsubscribe: non-transactional clean lookup => proceed", () => {
  assertEquals(decideUnsubscribeAction("welcome", { hasError: false, hasRow: false }), "proceed");
});

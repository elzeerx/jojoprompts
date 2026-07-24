// Pure/unit tests for submit-contact validation and Resend transport.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateContact, validateSubmissionId } from "./validation.ts";
import { resendIdempotencyKey, sendResendEmail } from "../_shared/resendClient.ts";

Deno.test("validateSubmissionId accepts uuid v4-ish", () => {
  assert(validateSubmissionId("00000000-0000-4000-8000-000000000000"));
  assert(validateSubmissionId("aBcDeF12-1234-5678-9abc-def012345678"));
});
Deno.test("validateSubmissionId rejects non-uuid", () => {
  assert(!validateSubmissionId("not-a-uuid"));
  assert(!validateSubmissionId(""));
  // deno-lint-ignore no-explicit-any
  assert(!validateSubmissionId(123 as any));
  // Old buggy client fallback shape must be rejected.
  assert(!validateSubmissionId("1712345678901-a1b2c3d4"));
});

const goodId = "12345678-1234-1234-1234-123456789012";

Deno.test("validateContact happy path normalizes email", () => {
  const r = validateContact({
    submission_id: goodId,
    name: "  Jane  ",
    email: "Jane@Example.COM",
    subject: "Hello",
    message: "Line 1\nLine 2",
  });
  if ("error" in r) throw new Error("expected ok");
  assertEquals(r.email, "jane@example.com");
  assertEquals(r.name, "Jane");
});

Deno.test("validateContact rejects unknown keys", () => {
  const r = validateContact({
    submission_id: goodId,
    name: "Jane", email: "j@example.com", subject: "s", message: "m",
    surprise: true,
  } as Record<string, unknown>);
  assertEquals("error" in r ? r.error : null, "unknown_field");
});

Deno.test("validateContact rejects caller-controlled recipient/subject/html keys", () => {
  for (const key of ["to","html","text","reply_to","from","headers","template_slug"]) {
    const r = validateContact({
      submission_id: goodId, name: "Jane", email: "j@example.com",
      subject: "s", message: "m", [key]: "x",
    } as Record<string, unknown>);
    assertEquals(
      "error" in r ? r.error : null,
      "unknown_field",
      `caller must not supply ${key}`,
    );
  }
});

Deno.test("validateContact rejects missing/short fields", () => {
  const base = { submission_id: goodId, name: "Jane", email: "j@example.com", subject: "s", message: "m" };
  for (const k of ["name","subject","message"] as const) {
    const bad = { ...base, [k]: "" };
    const r = validateContact(bad);
    assert("error" in r, `expected error for empty ${k}`);
  }
});

Deno.test("validateContact rejects invalid email", () => {
  const r = validateContact({
    submission_id: goodId, name: "Jane", email: "not-an-email", subject: "s", message: "m",
  });
  assertEquals("error" in r ? r.error : null, "invalid_email");
});

Deno.test("validateContact rejects invalid submission_id", () => {
  const r = validateContact({
    submission_id: "nope", name: "Jane", email: "j@example.com", subject: "s", message: "m",
  });
  assertEquals("error" in r ? r.error : null, "invalid_submission_id");
});

Deno.test("validateContact enforces length caps", () => {
  const r = validateContact({
    submission_id: goodId, name: "Jane", email: "j@example.com",
    subject: "x".repeat(500), message: "m",
  });
  assertEquals("error" in r ? r.error : null, "invalid_subject");
  const r2 = validateContact({
    submission_id: goodId, name: "Jane", email: "j@example.com",
    subject: "s", message: "x".repeat(6000),
  });
  assertEquals("error" in r2 ? r2.error : null, "invalid_message");
});

Deno.test("submit-contact idempotency keys differ per leg for same submission_id", () => {
  const id = goodId;
  const conf = resendIdempotencyKey("contact_confirmation", id);
  const adm  = resendIdempotencyKey("contact_admin", id);
  assert(conf !== adm);
  assertEquals(conf, resendIdempotencyKey("contact_confirmation", id));
  assertEquals(adm,  resendIdempotencyKey("contact_admin", id));
});

Deno.test("submit-contact leg transport: distinct Idempotency-Key headers across legs", async () => {
  const seen: string[] = [];
  const mockFetch: typeof fetch = async (_input, init) => {
    seen.push(String((init as any)?.headers?.["Idempotency-Key"] ?? ""));
    return new Response(JSON.stringify({ id: "x" }), { status: 200 });
  };
  const id = goodId;
  await sendResendEmail(
    { from: "a@x.com", to: "b@x.com", subject: "s", html: "h" },
    "k", resendIdempotencyKey("contact_confirmation", id), mockFetch,
  );
  await sendResendEmail(
    { from: "a@x.com", to: "c@x.com", subject: "s", html: "h" },
    "k", resendIdempotencyKey("contact_admin", id), mockFetch,
  );
  assert(seen[0].startsWith("contact_confirmation:"));
  assert(seen[1].startsWith("contact_admin:"));
  assert(seen[0] !== seen[1]);
});

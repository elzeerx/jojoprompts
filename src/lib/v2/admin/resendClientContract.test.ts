import { describe, expect, it } from "bun:test";
import {
  sendResendEmail,
  type ResendSendPayload,
} from "../../../../supabase/functions/_shared/resendClient";

const payload: ResendSendPayload = {
  from: "Jojo <info@jojoprompts.com>",
  to: "customer@example.com",
  subject: "Receipt",
  html: "<p>Receipt</p>",
  text: "Receipt",
};

describe("Resend REST transport contract", () => {
  it("sends the actual HTTP Idempotency-Key header", async () => {
    let captured: Request | null = null;
    const fakeFetch: typeof fetch = async (input, init) => {
      captured = new Request(input, init);
      return new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await sendResendEmail(
      payload,
      "re_test",
      "v2-order-receipt/order-123",
      fakeFetch,
    );

    expect(result).toEqual({
      ok: true,
      status: 200,
      id: "email_123",
    });
    expect(captured).not.toBeNull();
    expect(captured?.headers.get("Idempotency-Key"))
      .toBe("v2-order-receipt/order-123");
    expect(captured?.headers.get("Authorization")).toBe("Bearer re_test");
  });

  it("returns only a bounded provider code for non-2xx responses", async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response(JSON.stringify({
        name: "concurrent_idempotent_requests",
        message: "sensitive raw provider detail",
      }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });

    const result = await sendResendEmail(payload, "re_test", "key", fakeFetch);
    expect(result).toEqual({
      ok: false,
      status: 409,
      id: null,
      errorCode: "provider_error",
      providerCode: "concurrent_idempotent_requests",
    });
    expect(JSON.stringify(result)).not.toContain("sensitive raw provider detail");
  });

  it("does not expose malformed provider codes", async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response(JSON.stringify({
        name: "bad code with spaces and secrets",
      }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });

    const result = await sendResendEmail(payload, "re_test", "key", fakeFetch);
    expect(result.providerCode).toBeUndefined();
    expect(result.errorCode).toBe("provider_error");
  });

  it("treats a transport exception as an outcome-unknown signal", async () => {
    const fakeFetch: typeof fetch = async () => {
      throw new Error("network failed after possible acceptance");
    };

    const result = await sendResendEmail(payload, "re_test", "key", fakeFetch);
    expect(result).toEqual({
      ok: false,
      status: 0,
      id: null,
      errorCode: "provider_exception",
    });
  });
});

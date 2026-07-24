import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  escapeHtml,
  formatKwd,
  renderReceiptHtml,
  renderReceiptLineHtml,
  safeProviderMessageId,
  sanitizeErrorCode,
  sanitizeErrorMessage,
  type ReceiptOrder,
} from "./v2ReceiptDelivery.ts";

Deno.test("escapeHtml escapes all dangerous chars", () => {
  assertEquals(
    escapeHtml(`<script>alert("x&y")</script>'`),
    "&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;&#39;",
  );
  assertEquals(escapeHtml(null), "");
  assertEquals(escapeHtml(undefined), "");
  assertEquals(escapeHtml(42), "42");
});

Deno.test("formatKwd renders 3-decimal KWD from integer fils", () => {
  assertEquals(formatKwd(0), "0.000 KWD");
  assertEquals(formatKwd(1), "0.001 KWD");
  assertEquals(formatKwd(900), "0.900 KWD");
  assertEquals(formatKwd(15000), "15.000 KWD");
  assertEquals(formatKwd(30250), "30.250 KWD");
});

Deno.test("formatKwd rejects invalid inputs", () => {
  assertEquals(formatKwd(-1), "0.000 KWD");
  assertEquals(formatKwd(1.5), "0.000 KWD");
  assertEquals(formatKwd(NaN), "0.000 KWD");
  assertEquals(formatKwd("abc"), "0.000 KWD");
  assertEquals(formatKwd(null), "0.000 KWD");
});

Deno.test("safeProviderMessageId trims and bounds length", () => {
  assertEquals(safeProviderMessageId(""), null);
  assertEquals(safeProviderMessageId("  "), null);
  assertEquals(safeProviderMessageId(123 as unknown), null);
  assertEquals(safeProviderMessageId("abc"), "abc");
  assertEquals(safeProviderMessageId("x".repeat(300))?.length, 200);
});

Deno.test("sanitizeErrorCode enforces regex", () => {
  assertEquals(sanitizeErrorCode(""), "unknown");
  assertEquals(sanitizeErrorCode("send_failed"), "send_failed");
  assertEquals(sanitizeErrorCode("has space"), "invalid_error_code");
  assertEquals(sanitizeErrorCode("x".repeat(81)), "invalid_error_code");
});

Deno.test("sanitizeErrorMessage bounds length", () => {
  assertEquals(sanitizeErrorMessage(""), "unknown_error");
  assertEquals(sanitizeErrorMessage("nope"), "nope");
  assertEquals(sanitizeErrorMessage("y".repeat(600)).length, 500);
});

Deno.test("renderReceiptLineHtml escapes bilingual titles", () => {
  const html = renderReceiptLineHtml({
    title_en: "<img>",
    title_ar: "قصة & رمز",
    resource_type: "prompt_pack",
    quantity: 2,
    unit_price_fils: 15000,
    line_total_fils: 30000,
  });
  assert(html.includes("&lt;img&gt;"));
  assert(html.includes("قصة &amp; رمز"));
  assert(html.includes("prompt_pack"));
  assert(html.includes("15.000 KWD"));
  assert(html.includes("30.000 KWD"));
  assert(html.includes(">2<"));
});

Deno.test("renderReceiptLineHtml handles all-null titles and bad qty", () => {
  const html = renderReceiptLineHtml({
    title_en: null, title_ar: null, resource_type: null,
    quantity: 0, unit_price_fils: 0, line_total_fils: 0,
  });
  assert(html.includes("&mdash;"));
  assert(html.includes(">1<"));
});

Deno.test("renderReceiptHtml assembles subject, links, totals, discount", () => {
  const order: ReceiptOrder = {
    order_id: "abc",
    order_number: "JP-2026-000123",
    settled_at: "2026-07-24T12:34:56Z",
    currency: "kwd",
    subtotal_fils: 30000,
    discount_fils: 500,
    total_fils: 29500,
    user_email: "buyer@example.com",
    user_id: "u1",
    provider: "UPayments",
    lines: [
      { title_en: "Prompt Pack A", title_ar: "حزمة أ", resource_type: "prompt_pack", quantity: 1, unit_price_fils: 15000, line_total_fils: 15000 },
      { title_en: "Skill B", title_ar: null, resource_type: "skill", quantity: 1, unit_price_fils: 15000, line_total_fils: 15000 },
    ],
  };
  const { subject, html, text } = renderReceiptHtml(order, "https://jojoprompts.com/");
  assert(subject.includes("JP-2026-000123"));
  assert(html.includes("JP-2026-000123"));
  assert(html.includes("29.500 KWD"));
  assert(html.includes("Discount"));
  assert(html.includes("-0.500 KWD"));
  assert(html.includes("https://jojoprompts.com/library"));
  assert(html.includes("https://jojoprompts.com/orders"));
  assert(html.includes("KWD"));
  // Bilingual: Arabic block present
  assert(html.includes("رقم الطلب"));
  // Text alt has both links
  assert(text.includes("/library"));
  assert(text.includes("/orders"));
});

Deno.test("renderReceiptHtml omits discount row when zero", () => {
  const order: ReceiptOrder = {
    order_id: "abc",
    order_number: "JP-1",
    settled_at: null,
    currency: "KWD",
    subtotal_fils: 15000,
    discount_fils: 0,
    total_fils: 15000,
    user_email: "b@e.com",
    user_id: null,
    provider: "upayments",
    lines: [{ title_en: "X", title_ar: null, resource_type: null, quantity: 1, unit_price_fils: 15000, line_total_fils: 15000 }],
  };
  const { html } = renderReceiptHtml(order, "https://x");
  assert(!html.includes(">Discount<"));
});

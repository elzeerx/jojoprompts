import { assertEquals, assert, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildReceiptLine,
  escapeHtml,
  formatKwd,
  receiptIdempotencyKey,
  renderReceiptHtml,
  renderReceiptLineHtml,
  renderReceiptLineText,
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

Deno.test("receiptIdempotencyKey is stable and bounded", () => {
  const id = "17745276-bdcb-492f-8527-63e60051f9b8";
  const k1 = receiptIdempotencyKey(id);
  const k2 = receiptIdempotencyKey(id);
  assertEquals(k1, k2);
  assertEquals(k1, `v2-order-receipt/${id}`);
  assert(k1.length <= 256);
});

Deno.test("receiptIdempotencyKey trims and rejects empty", () => {
  assertEquals(receiptIdempotencyKey("  abc  "), "v2-order-receipt/abc");
  assertThrows(() => receiptIdempotencyKey(""));
  assertThrows(() => receiptIdempotencyKey("   "));
});

Deno.test("receiptIdempotencyKey caps at 256 chars for pathological input", () => {
  const huge = "x".repeat(400);
  const k = receiptIdempotencyKey(huge);
  assertEquals(k.length, 256);
  assert(k.startsWith("v2-order-receipt/"));
});

Deno.test("receiptIdempotencyKey differs per order", () => {
  assert(receiptIdempotencyKey("a") !== receiptIdempotencyKey("b"));
});

// -------------------- buildReceiptLine fallback --------------------

Deno.test("buildReceiptLine prefers resource fields when present", () => {
  const line = buildReceiptLine(
    { quantity: 1, unit_price_fils: 15000, line_total_fils: 15000 },
    { title_en: "R-EN", title_ar: "R-AR", type: "prompt_pack" },
    { title_en: "P-EN", title_ar: "P-AR", type: "individual" },
  );
  assertEquals(line.title_en, "R-EN");
  assertEquals(line.title_ar, "R-AR");
  assertEquals(line.resource_type, "prompt_pack");
});

Deno.test("buildReceiptLine falls back to product for bundle (no resource)", () => {
  const line = buildReceiptLine(
    { quantity: 1, unit_price_fils: 25000, line_total_fils: 25000 },
    null,
    { title_en: "Starter Bundle", title_ar: "حزمة البداية", type: "bundle" },
  );
  assertEquals(line.title_en, "Starter Bundle");
  assertEquals(line.title_ar, "حزمة البداية");
  assertEquals(line.resource_type, "bundle");
});

Deno.test("buildReceiptLine falls back to product for Full Library Lifetime", () => {
  const line = buildReceiptLine(
    { quantity: 1, unit_price_fils: 30000, line_total_fils: 30000 },
    null,
    { title_en: "Full Library Lifetime", title_ar: "المكتبة الكاملة", type: "lifetime" },
  );
  assertEquals(line.title_en, "Full Library Lifetime");
  assertEquals(line.title_ar, "المكتبة الكاملة");
  assertEquals(line.resource_type, "lifetime");
});

Deno.test("buildReceiptLine mixes resource title with product-type fallback", () => {
  const line = buildReceiptLine(
    { quantity: 2, unit_price_fils: 5000, line_total_fils: 10000 },
    { title_en: "R-EN", title_ar: null, type: null },
    { title_en: "P-EN", title_ar: "P-AR", type: "individual" },
  );
  assertEquals(line.title_en, "R-EN");
  assertEquals(line.title_ar, "P-AR");
  assertEquals(line.resource_type, "individual");
  assertEquals(line.quantity, 2);
});

Deno.test("buildReceiptLine treats empty/whitespace as missing", () => {
  const line = buildReceiptLine(
    { quantity: 1, unit_price_fils: 0, line_total_fils: 0 },
    { title_en: "  ", title_ar: "", type: "  " },
    { title_en: "P-EN", title_ar: "P-AR", type: "bundle" },
  );
  assertEquals(line.title_en, "P-EN");
  assertEquals(line.title_ar, "P-AR");
  assertEquals(line.resource_type, "bundle");
});

Deno.test("buildReceiptLine returns nulls when both sources empty", () => {
  const line = buildReceiptLine(
    { quantity: 0, unit_price_fils: 0, line_total_fils: 0 },
    null, null,
  );
  assertEquals(line.title_en, null);
  assertEquals(line.title_ar, null);
  assertEquals(line.resource_type, null);
  assertEquals(line.quantity, 1); // bad qty coerced
});

// -------------------- renderReceiptLineText --------------------

Deno.test("renderReceiptLineText is plain text with no HTML entities or tags", () => {
  const t = renderReceiptLineText({
    title_en: "Prompt Pack A", title_ar: "حزمة أ",
    resource_type: "prompt_pack",
    quantity: 2, unit_price_fils: 15000, line_total_fils: 30000,
  });
  assert(!t.includes("<"));
  assert(!t.includes(">"));
  assert(!t.includes("&amp;"));
  assert(!t.includes("&mdash;"));
  assert(t.includes("Prompt Pack A"));
  assert(t.includes("حزمة أ"));
  assert(t.includes("[prompt_pack]"));
  assert(t.includes("qty 2"));
  assert(t.includes("30.000 KWD"));
});

Deno.test("renderReceiptLineText handles product-only bundle and lifetime", () => {
  const bundle = renderReceiptLineText({
    title_en: "Starter Bundle", title_ar: "حزمة البداية",
    resource_type: "bundle",
    quantity: 1, unit_price_fils: 25000, line_total_fils: 25000,
  });
  assert(bundle.includes("Starter Bundle / حزمة البداية"));
  assert(bundle.includes("[bundle]"));
  assert(bundle.includes("25.000 KWD"));

  const lifetime = renderReceiptLineText({
    title_en: "Full Library Lifetime", title_ar: null,
    resource_type: "lifetime",
    quantity: 1, unit_price_fils: 30000, line_total_fils: 30000,
  });
  assert(lifetime.includes("Full Library Lifetime"));
  assert(lifetime.includes("[lifetime]"));
});

Deno.test("renderReceiptLineText falls back to em dash without HTML entity", () => {
  const t = renderReceiptLineText({
    title_en: null, title_ar: null, resource_type: null,
    quantity: 1, unit_price_fils: 0, line_total_fils: 0,
  });
  assert(t.includes("—"));
  assert(!t.includes("&mdash;"));
});

// -------------------- renderReceiptHtml text branch --------------------

Deno.test("renderReceiptHtml text branch includes item lines, subtotal, total", () => {
  const order: ReceiptOrder = {
    order_id: "abc",
    order_number: "JP-BUNDLE-1",
    settled_at: "2026-07-24T12:00:00Z",
    currency: "KWD",
    subtotal_fils: 25000,
    discount_fils: 500,
    total_fils: 24500,
    user_email: "b@e.com",
    user_id: "u1",
    provider: "UPayments",
    lines: [
      { title_en: "Starter Bundle", title_ar: "حزمة البداية", resource_type: "bundle",
        quantity: 1, unit_price_fils: 25000, line_total_fils: 25000 },
    ],
  };
  const { text, html } = renderReceiptHtml(order, "https://jojoprompts.com");
  assert(text.includes("Items:"));
  assert(text.includes("Starter Bundle"));
  assert(text.includes("[bundle]"));
  assert(text.includes("25.000 KWD"));
  assert(text.includes("Subtotal: 25.000 KWD"));
  assert(text.includes("Discount: -0.500 KWD"));
  assert(text.includes("Total:    24.500 KWD"));
  // Plain text must not contain HTML fragments
  assert(!text.includes("<td"));
  assert(!text.includes("<tr"));
  assert(!text.includes("&amp;"));
  // HTML branch still fine
  assert(html.includes("Starter Bundle"));
});

Deno.test("renderReceiptHtml text omits discount line when zero", () => {
  const order: ReceiptOrder = {
    order_id: "abc", order_number: "JP-2", settled_at: null, currency: "KWD",
    subtotal_fils: 15000, discount_fils: 0, total_fils: 15000,
    user_email: "b@e.com", user_id: null, provider: "upayments",
    lines: [{ title_en: "X", title_ar: null, resource_type: null,
      quantity: 1, unit_price_fils: 15000, line_total_fils: 15000 }],
  };
  const { text } = renderReceiptHtml(order, "https://x");
  assert(!text.includes("Discount:"));
  assert(text.includes("Subtotal: 15.000 KWD"));
  assert(text.includes("Total:    15.000 KWD"));
});

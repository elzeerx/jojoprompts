/**
 * Callback URL parsing helpers for the V2 UPayments checkout return/cancel
 * pages.
 *
 * Historically we constructed callback URLs as
 *   /checkout/return?order_id=<uuid>
 * UPayments appends its own query string with another `?`, producing the
 * malformed
 *   /checkout/return?order_id=<uuid>?payment_id=...&result=...
 * where the browser treats `order_id` as literally `<uuid>?payment_id=...`.
 *
 * The new construction uses a path parameter:
 *   /checkout/return/<uuid>
 * UPayments can then append `?payment_id=...` normally. Legacy links must
 * continue to resolve to the correct local order id, so callers combine
 * both sources and pass them through `resolveCallbackOrderId`.
 *
 * SECURITY: only a syntactically valid UUID is returned. Provider query
 * parameters MUST NOT be able to override the path-derived order id, and
 * any non-UUID input is rejected.
 */
export const CALLBACK_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Extract exactly one UUID from an untrusted string, or null. */
export function extractLeadingUuid(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  if (CALLBACK_UUID_RE.test(raw)) return raw;
  // Legacy malformed form: `<uuid>?payment_id=...` — extract only the
  // part before the first `?` (or `&`) and re-validate as a UUID.
  const cut = raw.split(/[?&#]/, 1)[0];
  if (cut && CALLBACK_UUID_RE.test(cut)) return cut;
  return null;
}

/**
 * Resolve the effective local order id for a checkout return/cancel page.
 * Path parameter wins over query parameter — provider-appended query
 * parameters cannot override the path-derived id. Both sources are
 * validated via {@link extractLeadingUuid}.
 */
export function resolveCallbackOrderId(
  pathParam: string | null | undefined,
  queryParam: string | null | undefined,
): string | null {
  const fromPath = extractLeadingUuid(pathParam);
  if (fromPath) return fromPath;
  return extractLeadingUuid(queryParam);
}

/**
 * Construct the clean, query-free callback bases the UPayments checkout
 * function sends to the provider. Exported for tests only — the edge
 * function has its own copy of this logic (Deno cannot import from the
 * browser bundle).
 */
export function buildCleanCallbackUrls(siteUrl: string, orderId: string): {
  returnUrl: string;
  cancelUrl: string;
} {
  const encoded = encodeURIComponent(orderId);
  return {
    returnUrl: `${siteUrl}/checkout/return/${encoded}`,
    cancelUrl: `${siteUrl}/checkout/cancel/${encoded}`,
  };
}

/**
 * Retired legacy Edge Function slugs.
 *
 * These endpoints have V2 replacements (see `v2-upayments-*`) and are being
 * retired at the platform level. Frontend code MUST NOT invoke them.
 *
 * A contract test (`legacyEndpointsRegression.test.ts`) fails the build if any
 * active src/** file (excluding this file, archival Edge Function source under
 * `supabase/functions/*`, and test fixtures) references a slug in this list.
 */
export const RETIRED_LEGACY_EDGE_SLUGS = [
  "process-upayments-payment",
  "upayments-webhook",
  "get-transaction-by-order",
  "recover-orphaned-payments",
  "scheduled-payment-cleanup",
  "send-purchase-confirmation",
  "create-paypal-payment",
  "capture-paypal-payment",
  "verify-paypal-payment",
  "process-paypal-payment",
  "auto-capture-paypal",
] as const;

export type RetiredLegacyEdgeSlug = (typeof RETIRED_LEGACY_EDGE_SLUGS)[number];

/**
 * Shape returned by neutralized legacy callers. Matches enough of the
 * `supabase.functions.invoke` result surface to satisfy call sites without
 * accidentally masquerading as success.
 */
export interface RetiredEndpointResult {
  data: null;
  error: { message: string; retired: true; slug: RetiredLegacyEdgeSlug };
}

export function retiredEndpointResult(
  slug: RetiredLegacyEdgeSlug,
): RetiredEndpointResult {
  return {
    data: null,
    error: {
      message: `Endpoint ${slug} is retired. Use the V2 payment surface (v2-upayments-*).`,
      retired: true,
      slug,
    },
  };
}

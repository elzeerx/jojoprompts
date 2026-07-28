/**
 * RETIRED (source-only, 2026-07-28): the `create-subscription` Edge
 * Function has been replaced with an HTTP 410 stub. The V2 contract is
 * one-time payments only — subscriptions no longer exist.
 *
 * This module has NO active importer (verified: route-graph unreachable
 * from `src/pages/admin/layout/adminSectionElements.tsx` and `src/App.tsx`).
 * It is preserved as a neutralized shim so any accidental future import
 * fails loudly instead of hitting the 410 stub over the network.
 */

export async function activateSubscription(_args: {
  planId: string;
  userId: string;
  paymentMethod: string;
  paymentId: string;
  paymentDetails: unknown;
  accessToken?: string;
}) {
  return {
    data: null,
    error: {
      message:
        "endpoint_retired: create-subscription is no longer available (V2 is one-time payments only).",
      name: "EndpointRetiredError",
    },
  };
}


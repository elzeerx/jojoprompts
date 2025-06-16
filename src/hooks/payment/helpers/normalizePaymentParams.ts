
// Stronger extraction for all possible PayPal return/callback params styles
export function normalizePaymentParams(params: Record<string, any>) {
  function getAny(keys: string[]) {
    for (const k of keys) {
      if (params[k]) return params[k];
      if (params[k.toLowerCase()]) return params[k.toLowerCase()];
      if (params[k.toUpperCase()]) return params[k.toUpperCase()];
      // New: Allow checking first in search params objects
      if (params.searchParams && typeof params.searchParams.get === "function") {
        const v = params.searchParams.get(k) || params.searchParams.get(k.toLowerCase()) || params.searchParams.get(k.toUpperCase());
        if (v) return v;
      }
    }
    return undefined;
  }

  const normalized = {
    planId: getAny(['planId', 'plan_id', 'PLAN_ID']),
    userId: getAny(['userId', 'user_id', 'USER_ID']),
    token: getAny(['token', 'orderId', 'order_id', 'ORDER_ID']),
    payerId: getAny(['PayerID', 'payer_id', 'PAYERID']),
    allParams: params,
  };

  console.log('Normalized payment params:', {
    input: params,
    normalized: normalized
  });

  return normalized;
}

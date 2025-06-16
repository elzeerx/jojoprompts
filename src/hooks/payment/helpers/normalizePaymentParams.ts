
// Stronger extraction for all possible PayPal return/callback params styles
export function normalizePaymentParams(params: Record<string, any>) {
  function getAny(keys: string[]) {
    for (const k of keys) {
      if (params[k]) return params[k];
      if (params[k.toLowerCase()]) return params[k.toLowerCase()];
      if (params[k.toUpperCase()]) return params[k.toUpperCase()];
    }
    return undefined;
  }

  return {
    planId: getAny(['planId', 'plan_id', 'PLAN_ID']),
    userId: getAny(['userId', 'user_id', 'USER_ID']),
    // PayPal order ID is sometimes called token, orderId, order_id, etc
    token: getAny(['token', 'orderId', 'order_id', 'ORDER_ID']),
    payerId: getAny(['PayerID', 'payer_id', 'PAYERID']),
    allParams: params,
  };
}

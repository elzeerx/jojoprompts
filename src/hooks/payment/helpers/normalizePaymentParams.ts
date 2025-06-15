
export function normalizePaymentParams(params: Record<string, any>) {
  const extractParam = (key: string) =>
    params[key] ||
    params[key.toLowerCase()] ||
    params[key.replace("_", "")] ||
    params[
      key.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase())
    ];
  return {
    planId: extractParam("planId") || extractParam("plan_id"),
    userId: extractParam("userId") || extractParam("user_id"),
    token: params.token,
    payerId: params.payerId,
    allParams: params.allParams,
  };
}

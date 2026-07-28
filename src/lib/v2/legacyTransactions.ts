export interface ReconstructableLegacyTransaction {
  amount_usd: number;
  currency: string | null;
  payment_gateway: string | null;
  subscription_plans: {
    tier: string;
    price_usd: number;
  } | null;
}

const LEGACY_PLAN_FILS: Record<string, number> = {
  basic: 15_000,
  standard: 20_000,
  premium: 25_000,
  ultimate: 30_000,
};

/**
 * Legacy UPayments rows stored the old USD package ratio rather than the
 * provider-returned KWD amount. This mirrors the approved migration mapping
 * and only returns a value when the reconstruction is deterministic.
 */
export function reconstructLegacyUpaymentsFils(
  transaction: ReconstructableLegacyTransaction,
): number | null {
  if (transaction.payment_gateway?.toLowerCase() !== "upayments") return null;
  if (transaction.currency?.toUpperCase() !== "KWD") return null;
  const plan = transaction.subscription_plans;
  const baseFils = plan ? LEGACY_PLAN_FILS[plan.tier.toLowerCase()] : undefined;
  if (!plan || !baseFils || plan.price_usd <= 0 || transaction.amount_usd <= 0) {
    return null;
  }
  const ratio = transaction.amount_usd / plan.price_usd;
  if (ratio <= 0 || ratio > 1) return null;
  return Math.round(baseFils * ratio);
}

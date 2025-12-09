/**
 * Currency utilities for multi-currency support (USD/KWD)
 * Fixed pricing for JojoPrompts subscription plans
 */

// Fixed USD to KWD conversion for subscription plans
export const PLAN_KWD_PRICES: Record<number, number> = {
  55: 15,   // Basic: $55 → 15 KWD
  65: 20,   // Standard: $65 → 20 KWD
  80: 25,   // Premium: $80 → 25 KWD
  100: 30   // Ultimate: $100 → 30 KWD
};

/**
 * Get KWD price for a given USD price
 */
export function getKWDPrice(usdPrice: number): number {
  return PLAN_KWD_PRICES[usdPrice] || Math.round(usdPrice * 0.31);
}

/**
 * Format amount in KWD
 */
export function formatKWD(amount: number): string {
  return `${amount.toFixed(2)} KWD`;
}

/**
 * Format amount in USD
 */
export function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Calculate discounted KWD price
 * Mirrors the discount logic from PaymentMethodsCard
 */
export function calculateDiscountedKWD(
  usdPrice: number,
  appliedDiscount: { discount_type: string; discount_value: number } | null
): number {
  const kwdPrice = getKWDPrice(usdPrice);
  
  if (!appliedDiscount) return kwdPrice;
  
  if (appliedDiscount.discount_type === 'percentage') {
    const discountAmount = (kwdPrice * appliedDiscount.discount_value) / 100;
    return Math.max(0, Math.round((kwdPrice - discountAmount) * 100) / 100);
  } else if (appliedDiscount.discount_type === 'fixed_amount') {
    // Convert USD fixed discount to KWD equivalent
    const kwdDiscount = appliedDiscount.discount_value * 0.31;
    return Math.max(0, Math.round((kwdPrice - kwdDiscount) * 100) / 100);
  }
  
  return kwdPrice;
}

/**
 * Calculate discounted USD price
 * Same logic as used in checkout
 */
export function calculateDiscountedUSD(
  usdPrice: number,
  appliedDiscount: { discount_type: string; discount_value: number } | null
): number {
  if (!appliedDiscount) return usdPrice;
  
  if (appliedDiscount.discount_type === 'percentage') {
    const discountAmount = (usdPrice * appliedDiscount.discount_value) / 100;
    return Math.max(0, Math.round((usdPrice - discountAmount) * 100) / 100);
  } else if (appliedDiscount.discount_type === 'fixed_amount') {
    return Math.max(0, Math.round((usdPrice - appliedDiscount.discount_value) * 100) / 100);
  }
  
  return usdPrice;
}

/**
 * Check if price is zero after discount
 */
export function isZeroAfterDiscount(
  usdPrice: number,
  appliedDiscount: { discount_type: string; discount_value: number } | null
): boolean {
  return calculateDiscountedUSD(usdPrice, appliedDiscount) === 0;
}

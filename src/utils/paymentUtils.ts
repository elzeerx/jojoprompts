import { safeLog } from "./safeLogging";

// Payment status constants
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PROCESSING: 'processing'
} as const;

// Payment method constants
export const PAYMENT_METHODS = {
  PAYPAL: 'paypal',
  DISCOUNT: 'discount',
  CREDIT_CARD: 'credit_card'
} as const;

// Payment validation utilities
export function validatePaymentParams(params: {
  orderId?: string;
  paymentId?: string;
  planId?: string;
  userId?: string;
}): { isValid: boolean; missingParams: string[] } {
  const missingParams: string[] = [];
  
  if (!params.orderId && !params.paymentId) {
    missingParams.push('orderId or paymentId');
  }
  
  if (!params.planId) {
    missingParams.push('planId');
  }
  
  if (!params.userId) {
    missingParams.push('userId');
  }
  
  return {
    isValid: missingParams.length === 0,
    missingParams
  };
}

// Payment parameter mapping utilities
export function mapPaymentParams(params: Record<string, string>): Record<string, string> {
  const mappedParams: Record<string, string> = {};
  
  // Map camelCase to snake_case for backend compatibility
  if (params.orderId) mappedParams['order_id'] = params.orderId;
  if (params.paymentId) mappedParams['payment_id'] = params.paymentId;
  if (params.userId) mappedParams['user_id'] = params.userId;
  if (params.planId) mappedParams['plan_id'] = params.planId;
  
  // Also include original parameters for backwards compatibility
  Object.keys(params).forEach(key => {
    if (!mappedParams[key]) {
      mappedParams[key] = params[key];
    }
  });

  safeLog.debug('Payment parameters mapped:', {
    original: params,
    mapped: mappedParams
  });

  return mappedParams;
}

// Payment context utilities
export function createPaymentContext(params: {
  orderId?: string;
  paymentId?: string;
  planId?: string;
  userId?: string;
  timestamp?: number;
}): Record<string, any> {
  return {
    orderId: params.orderId,
    paymentId: params.paymentId,
    planId: params.planId,
    userId: params.userId,
    timestamp: params.timestamp || Date.now()
  };
}

// Payment URL utilities
export function buildPaymentSuccessUrl(params: {
  planId: string;
  userId: string;
  paymentId: string;
  status?: string;
  source?: string;
}): string {
  const searchParams = new URLSearchParams({
    planId: params.planId,
    userId: params.userId,
    paymentId: params.paymentId,
    status: params.status || 'completed',
    ...(params.source && { source: params.source })
  });
  
  return `/payment-success?${searchParams.toString()}`;
}

export function buildPaymentFailedUrl(params: {
  planId?: string;
  reason: string;
  status?: string;
}): string {
  const searchParams = new URLSearchParams({
    reason: params.reason,
    status: params.status || 'failed',
    ...(params.planId && { planId: params.planId })
  });
  
  return `/payment-failed?${searchParams.toString()}`;
}

// Payment state utilities
export function isPaymentSuccessful(status: string): boolean {
  return status === PAYMENT_STATUS.COMPLETED || status === 'COMPLETED';
}

export function isPaymentFailed(status: string): boolean {
  return status === PAYMENT_STATUS.FAILED || status === 'FAILED';
}

export function isPaymentPending(status: string): boolean {
  return status === PAYMENT_STATUS.PENDING || status === 'PENDING';
}

// Discount payment utilities
export function isDiscountPayment(paymentMethod?: string, paymentId?: string): boolean {
  return paymentMethod === 'discount_100_percent' || 
         (paymentId && paymentId.startsWith('discount_'));
}

// Payment amount utilities
export function formatPaymentAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

export function calculateDiscountAmount(originalAmount: number, discountPercentage: number): number {
  return originalAmount * (discountPercentage / 100);
}

export function calculateFinalAmount(originalAmount: number, discountAmount: number = 0): number {
  return Math.max(0, originalAmount - discountAmount);
} 
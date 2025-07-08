
// Payment state machine for consistent processing
export const PAYMENT_STATES = {
  UNKNOWN: 'UNKNOWN',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  ERROR: 'ERROR'
} as const;

export type PaymentState = typeof PAYMENT_STATES[keyof typeof PAYMENT_STATES];

export interface VerificationContext {
  requestId: string;
  supabaseClient: any;
  accessToken: string;
  params: Record<string, any>;
  localTx?: any;
  orderIdToUse?: string;
  paymentIdToUse?: string;
  planId?: string;
  userId?: string;
  subscription?: any;
}

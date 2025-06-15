
export interface UsePaymentProcessingArgs {
  success: string | null;
  paymentId: string | null;
  orderId: string | null;
  planId: string | null;
  userId: string | null;
  debugObject: any;
  hasSessionIndependentData: boolean;
}

export interface SubscriptionResult {
  hasSubscription: boolean;
  transaction: any;
  subscription: any;
}

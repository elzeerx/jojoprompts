import { useCallback } from 'react';
import { PaymentStateVerifier } from '../helpers/paymentStateVerifier';
import { checkDatabaseFirst } from '../utils/databaseVerification';
import { safeLog } from '@/utils/safeLogging';
import { isDiscountPayment } from '@/utils/paymentUtils';

interface PaymentVerificationResult {
  isSuccessful: boolean;
  hasActiveSubscription: boolean;
  subscription?: any;
  needsAuthentication: boolean;
  errorMessage?: string;
}

export function usePaymentVerification() {
  const verifyPaymentState = useCallback(async (
    effectiveUserId: string,
    planId: string,
    orderId: string,
    paymentId: string
  ): Promise<PaymentVerificationResult> => {
    safeLog.debug('Starting database-first payment verification');
    
    const verificationResult = await PaymentStateVerifier.verifyPaymentState(
      effectiveUserId,
      planId,
      orderId,
      paymentId
    );

    if (verificationResult.isSuccessful && verificationResult.hasActiveSubscription) {
      safeLog.debug('Database verification: Payment successful, subscription active');
      return {
        isSuccessful: true,
        hasActiveSubscription: true,
        subscription: verificationResult.subscription,
        needsAuthentication: false
      };
    }

    return {
      isSuccessful: false,
      hasActiveSubscription: false,
      needsAuthentication: verificationResult.needsAuthentication,
      errorMessage: verificationResult.errorMessage
    };
  }, []);

  const verifyDiscountPayment = useCallback(async (
    effectiveUserId: string,
    planId: string,
    orderId: string
  ): Promise<PaymentVerificationResult | null> => {
    const { hasSubscription, subscription } = await checkDatabaseFirst({ 
      userId: effectiveUserId, 
      planId, 
      orderId 
    });
    
    if (hasSubscription && subscription) {
      const isDiscount = isDiscountPayment(subscription.payment_method, subscription.payment_id);
      
      if (isDiscount) {
        safeLog.debug('Discount-based payment detected');
        return {
          isSuccessful: true,
          hasActiveSubscription: true,
          subscription,
          needsAuthentication: false
        };
      }
    }

    return null;
  }, []);

  const validatePaymentParams = useCallback((
    orderId?: string,
    paymentId?: string,
    planId?: string,
    userId?: string
  ): { isValid: boolean; missingParams: string[] } => {
    const missingParams: string[] = [];
    
    if (!orderId && !paymentId) {
      missingParams.push('orderId or paymentId');
    }
    
    if (!planId) {
      missingParams.push('planId');
    }
    
    if (!userId) {
      missingParams.push('userId');
    }
    
    return {
      isValid: missingParams.length === 0,
      missingParams
    };
  }, []);

  return {
    verifyPaymentState,
    verifyDiscountPayment,
    validatePaymentParams
  };
} 
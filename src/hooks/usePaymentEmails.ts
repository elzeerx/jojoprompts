import { useState, useCallback } from 'react';
import { emailService } from '@/utils/emailService';
import { createLogger } from '@/utils/logging';

const logger = createLogger('PAYMENT_EMAILS');

export function usePaymentEmails() {
  const [isSending, setIsSending] = useState(false);

  const sendPaymentConfirmation = useCallback(async (
    name: string, 
    email: string, 
    planName: string, 
    amount: number, 
    transactionId: string
  ) => {
    setIsSending(true);
    try {
      const result = await emailService.sendPaymentConfirmation(name, email, planName, amount, transactionId);
      if (!result.success) {
        logger.warn('Payment confirmation email failed', { error: result.error, email });
      }
      return result;
    } catch (error) {
      logger.error('Payment confirmation email error', { error, email });
      return { success: false, error: 'Failed to send payment confirmation email' };
    } finally {
      setIsSending(false);
    }
  }, []);

  const sendPaymentFailed = useCallback(async (
    name: string, 
    email: string, 
    planName: string, 
    reason: string, 
    retryLink: string
  ) => {
    setIsSending(true);
    try {
      const result = await emailService.sendPaymentFailed(name, email, planName, reason, retryLink);
      if (!result.success) {
        logger.warn('Payment failed email failed', { error: result.error, email });
      }
      return result;
    } catch (error) {
      logger.error('Payment failed email error', { error, email });
      return { success: false, error: 'Failed to send payment failed email' };
    } finally {
      setIsSending(false);
    }
  }, []);

  const sendSubscriptionCancelled = useCallback(async (
    name: string, 
    email: string, 
    planName: string, 
    endDate: string
  ) => {
    setIsSending(true);
    try {
      const result = await emailService.sendSubscriptionCancelled(name, email, planName, endDate);
      if (!result.success) {
        logger.warn('Subscription cancelled email failed', { error: result.error, email });
      }
      return result;
    } catch (error) {
      logger.error('Subscription cancelled email error', { error, email });
      return { success: false, error: 'Failed to send subscription cancelled email' };
    } finally {
      setIsSending(false);
    }
  }, []);

  return { 
    sendPaymentConfirmation, 
    sendPaymentFailed, 
    sendSubscriptionCancelled, 
    isSending 
  };
}

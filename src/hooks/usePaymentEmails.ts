
import { useState, useCallback } from 'react';
import { emailService } from '@/utils/emailService';

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
        console.warn('Payment confirmation email failed to send:', result.error);
      }
      return result;
    } catch (error) {
      console.error('Payment confirmation email error:', error);
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
        console.warn('Payment failed email failed to send:', result.error);
      }
      return result;
    } catch (error) {
      console.error('Payment failed email error:', error);
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
        console.warn('Subscription cancelled email failed to send:', result.error);
      }
      return result;
    } catch (error) {
      console.error('Subscription cancelled email error:', error);
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

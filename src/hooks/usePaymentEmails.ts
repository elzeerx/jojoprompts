
import { useCallback } from 'react';
import { emailService } from '@/utils/emailService';

export function usePaymentEmails() {
  const sendPaymentConfirmation = useCallback(async (
    userName: string,
    userEmail: string,
    planName: string,
    amount: number,
    paymentId: string,
    subscriptionEndDate?: string
  ) => {
    try {
      console.log('Sending payment confirmation email to:', userEmail);
      const result = await emailService.sendPaymentConfirmation(
        userName,
        userEmail,
        planName,
        amount,
        paymentId,
        subscriptionEndDate
      );
      
      if (result.success) {
        console.log('Payment confirmation email sent successfully');
      } else {
        console.error('Payment confirmation email failed:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Payment confirmation email error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  const sendSubscriptionActivation = useCallback(async (
    userName: string,
    userEmail: string,
    planName: string,
    subscriptionEndDate: string,
    amount: number,
    paymentMethod: string
  ) => {
    try {
      console.log('Sending subscription activation email to:', userEmail);
      const result = await emailService.sendSubscriptionActivation(
        userName,
        userEmail,
        planName,
        subscriptionEndDate,
        amount,
        paymentMethod
      );
      
      if (result.success) {
        console.log('Subscription activation email sent successfully');
      } else {
        console.error('Subscription activation email failed:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Subscription activation email error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  const sendInvoiceReceipt = useCallback(async (
    userName: string,
    userEmail: string,
    invoiceNumber: string,
    planName: string,
    amount: number,
    paymentDate: string,
    paymentMethod: string,
    billingPeriod: string
  ) => {
    try {
      console.log('Sending invoice receipt email to:', userEmail);
      const result = await emailService.sendInvoiceReceipt(
        userName,
        userEmail,
        invoiceNumber,
        planName,
        amount,
        paymentDate,
        paymentMethod,
        billingPeriod
      );
      
      if (result.success) {
        console.log('Invoice receipt email sent successfully');
      } else {
        console.error('Invoice receipt email failed:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Invoice receipt email error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  return {
    sendPaymentConfirmation,
    sendSubscriptionActivation,
    sendInvoiceReceipt
  };
}

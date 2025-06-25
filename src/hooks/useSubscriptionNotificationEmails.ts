
import { useCallback } from 'react';
import { emailService } from '@/utils/emailService';

export function useSubscriptionNotificationEmails() {
  const sendSubscriptionStatusChange = useCallback(async (
    userName: string,
    userEmail: string,
    planName: string,
    statusChange: 'cancelled' | 'suspended' | 'reactivated' | 'expired',
    effectiveDate: string,
    reason?: string
  ) => {
    try {
      console.log(`Sending subscription status change email (${statusChange}) to:`, userEmail);
      const result = await emailService.sendSubscriptionStatusChange(
        userName,
        userEmail,
        planName,
        statusChange,
        effectiveDate,
        reason
      );
      
      if (result.success) {
        console.log('Subscription status change email sent successfully');
      } else {
        console.error('Subscription status change email failed:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Subscription status change email error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  const sendAccountUpgrade = useCallback(async (
    userName: string,
    userEmail: string,
    fromPlan: string,
    toPlan: string,
    upgradeDate: string,
    newFeatures: string[]
  ) => {
    try {
      console.log('Sending account upgrade email to:', userEmail);
      const result = await emailService.sendAccountUpgrade(
        userName,
        userEmail,
        fromPlan,
        toPlan,
        upgradeDate,
        newFeatures
      );
      
      if (result.success) {
        console.log('Account upgrade email sent successfully');
      } else {
        console.error('Account upgrade email failed:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Account upgrade email error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  const sendRenewalReminder = useCallback(async (
    userName: string,
    userEmail: string,
    planName: string,
    expirationDate: string,
    daysUntilExpiration: number,
    renewalUrl: string
  ) => {
    try {
      console.log('Sending renewal reminder email to:', userEmail);
      const result = await emailService.sendRenewalReminder(
        userName,
        userEmail,
        planName,
        expirationDate,
        daysUntilExpiration,
        renewalUrl
      );
      
      if (result.success) {
        console.log('Renewal reminder email sent successfully');
      } else {
        console.error('Renewal reminder email failed:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('Renewal reminder email error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  return {
    sendSubscriptionStatusChange,
    sendAccountUpgrade,
    sendRenewalReminder
  };
}

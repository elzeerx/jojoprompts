import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function usePostPurchaseEmail() {
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const sendPostPurchaseEmails = async (
    userEmail: string,
    firstName: string,
    planName: string,
    paymentId: string
  ) => {
    setSending(true);
    
    try {
      // Send purchase confirmation email
      await supabase.functions.invoke('send-purchase-confirmation', {
        body: {
          email: userEmail,
          firstName,
          planName,
          paymentId
        }
      });

      // Send optional email confirmation reminder
      await supabase.functions.invoke('send-email-confirmation-reminder', {
        body: {
          email: userEmail,
          firstName
        }
      });

      console.log('Post-purchase emails sent successfully');
    } catch (error) {
      console.warn('Post-purchase emails failed (non-critical):', error);
      // Don't show error to user - this is non-critical
    } finally {
      setSending(false);
    }
  };

  const sendEmailConfirmationReminder = async (userEmail: string, firstName: string) => {
    try {
      await supabase.functions.invoke('send-email-confirmation-reminder', {
        body: {
          email: userEmail,
          firstName
        }
      });
      
      toast({
        title: "Confirmation email sent",
        description: "Check your email to verify your account for enhanced security.",
      });
    } catch (error) {
      console.warn('Email confirmation reminder failed:', error);
      toast({
        variant: "destructive",
        title: "Failed to send confirmation",
        description: "You can verify your email later in account settings.",
      });
    }
  };

  return {
    sendPostPurchaseEmails,
    sendEmailConfirmationReminder,
    sending
  };
}
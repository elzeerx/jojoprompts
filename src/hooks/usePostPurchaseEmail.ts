import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logging';

const logger = createLogger('POST_PURCHASE_EMAIL');

/**
 * V2 release-hardening: the retired `send-purchase-confirmation` Edge
 * Function is not invoked. Post-purchase transactional email is delivered
 * server-side by the V2 payment pipeline. This hook is kept as a no-op for
 * `sendPostPurchaseEmails` so callers remain valid; the email-confirmation
 * reminder helper is preserved because it is still a supported endpoint.
 */
export function usePostPurchaseEmail() {
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const sendPostPurchaseEmails = async (
    userEmail: string,
    _firstName: string,
    planName: string,
    _paymentId: string,
  ) => {
    // Intentionally does not invoke `send-purchase-confirmation` (retired).
    setSending(false);
    logger.debug('sendPostPurchaseEmails is a no-op (retired endpoint)', {
      email: userEmail,
      planName,
    });
  };

  const sendEmailConfirmationReminder = async (userEmail: string, firstName: string) => {
    try {
      await supabase.functions.invoke('send-email-confirmation-reminder', {
        body: { email: userEmail, firstName },
      });
      toast({
        title: 'Confirmation email sent',
        description: 'Check your email to verify your account for enhanced security.',
      });
    } catch (error) {
      logger.warn('Email confirmation reminder failed', { error, email: userEmail });
      toast({
        variant: 'destructive',
        title: 'Failed to send confirmation',
        description: 'You can verify your email later in account settings.',
      });
    }
  };

  return { sendPostPurchaseEmails, sendEmailConfirmationReminder, sending };
}

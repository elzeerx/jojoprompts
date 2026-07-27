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

  const sendEmailConfirmationReminder = async (userEmail: string, _firstName: string) => {
    // V2 release-hardening: the `send-email-confirmation-reminder` Edge
    // Function is retired. Email confirmation is delivered by Supabase
    // Auth's built-in signup flow; there is no client trigger for
    // arbitrary reminder mail. Kept as a no-op so callers stay valid.
    logger.debug('sendEmailConfirmationReminder is a no-op (retired endpoint)', {
      email: userEmail,
    });
  };


  return { sendPostPurchaseEmails, sendEmailConfirmationReminder, sending };
}

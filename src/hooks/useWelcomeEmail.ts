import { useState } from 'react';
import { emailService } from '@/utils/emailService';
import { createLogger } from '@/utils/logging';

const logger = createLogger('WELCOME_EMAIL');

export function useWelcomeEmail() {
  const [isSending, setIsSending] = useState(false);

  const sendWelcomeEmail = async (name: string, email: string) => {
    setIsSending(true);
    try {
      const result = await emailService.sendWelcomeEmail(name, email);
      if (!result.success) {
        logger.warn('Welcome email failed', { error: result.error, email });
      }
      return result;
    } catch (error) {
      logger.error('Welcome email error', { error, email });
      return { success: false, error: 'Failed to send welcome email' };
    } finally {
      setIsSending(false);
    }
  };

  return { sendWelcomeEmail, isSending };
}

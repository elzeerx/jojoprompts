
import { useState } from 'react';
import { emailService } from '@/utils/emailService';

export function useWelcomeEmail() {
  const [isSending, setIsSending] = useState(false);

  const sendWelcomeEmail = async (name: string, email: string) => {
    setIsSending(true);
    try {
      const result = await emailService.sendWelcomeEmail(name, email);
      if (!result.success) {
        console.warn('Welcome email failed to send:', result.error);
      }
      return result;
    } catch (error) {
      console.error('Welcome email error:', error);
      return { success: false, error: 'Failed to send welcome email' };
    } finally {
      setIsSending(false);
    }
  };

  return { sendWelcomeEmail, isSending };
}

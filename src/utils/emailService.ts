import { supabase } from "@/integrations/supabase/client";
import { emailTemplates } from "./emailTemplates";
import { createLogger } from './logging';

const logger = createLogger('EMAIL_SERVICE');

interface EmailServiceResponse {
  success: boolean;
  error?: string;
}

class EmailService {
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string,
    email_type: string = 'general',
    retryCount = 0,
  ): Promise<EmailServiceResponse> {
    const maxRetries = 2;

    try {
      logger.debug('Sending email', { to, subject, attempt: retryCount + 1 });

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { to, subject, html, text, email_type },
      });

      if (error) {
        logger.error('Email service error', { attempt: retryCount + 1 });
        if (retryCount < maxRetries && this.isRetryableError(error)) {
          await this.delay(1000 * (retryCount + 1));
          return this.sendEmail(to, subject, html, text, email_type, retryCount + 1);
        }
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        logger.error('Email sending failed', { attempt: retryCount + 1 });
        if (retryCount < maxRetries && this.isRetryableError(data?.error)) {
          await this.delay(1000 * (retryCount + 1));
          return this.sendEmail(to, subject, html, text, email_type, retryCount + 1);
        }
        return { success: false, error: data?.error || 'Failed to send email' };
      }

      logger.info('Email sent successfully');
      return { success: true };
    } catch (error: any) {
      logger.error('Email service exception', { attempt: retryCount + 1 });
      if (retryCount < maxRetries) {
        await this.delay(1000 * (retryCount + 1));
        return this.sendEmail(to, subject, html, text, email_type, retryCount + 1);
      }
      return { success: false, error: error.message };
    }
  }

  private isRetryableError(error: any): boolean {
    if (!error) return false;
    const errorMessage = typeof error === 'string' ? error : error.message || '';
    const retryableErrors = [
      'network', 'timeout', 'temporary', 'rate limit',
      'service unavailable', 'internal server error',
    ];
    return retryableErrors.some(e => errorMessage.toLowerCase().includes(e));
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sendWelcomeEmail(name: string, email: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.welcome({ name, email });
    return this.sendEmail(email, template.subject, template.html, template.text, 'welcome');
  }

  async sendPasswordResetEmail(name: string, email: string, resetLink: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.passwordReset({ name, resetLink });
    return this.sendEmail(email, template.subject, template.html, template.text, 'password_reset');
  }

  async sendPaymentConfirmation(name: string, email: string, planName: string, amount: number, transactionId: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.paymentConfirmation({ name, planName, amount, transactionId });
    return this.sendEmail(email, template.subject, template.html, template.text, 'payment_confirmation');
  }

  async sendSubscriptionCancelled(name: string, email: string, planName: string, endDate: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.subscriptionCancelled({ name, planName, endDate });
    return this.sendEmail(email, template.subject, template.html, template.text, 'subscription_cancelled');
  }

  async sendPaymentFailed(name: string, email: string, planName: string, reason: string, retryLink: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.paymentFailed({ name, planName, reason, retryLink });
    return this.sendEmail(email, template.subject, template.html, template.text, 'payment_failed');
  }

  async sendAccountDeleted(name: string, email: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.accountDeleted({ name });
    return this.sendEmail(email, template.subject, template.html, template.text, 'account_deleted');
  }

  async sendEmailConfirmation(name: string, email: string, confirmationLink: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.emailConfirmation({ name, email, confirmationLink });
    return this.sendEmail(email, template.subject, template.html, template.text, 'email_confirmation');
  }
}


export const emailService = new EmailService();

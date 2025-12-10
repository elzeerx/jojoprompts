import { supabase } from "@/integrations/supabase/client";
import { emailTemplates } from "./emailTemplates";
import { createLogger } from './logging';

const logger = createLogger('EMAIL_SERVICE');

interface EmailServiceResponse {
  success: boolean;
  error?: string;
}

class EmailService {
  private async sendEmail(to: string, subject: string, html: string, text?: string, retryCount = 0): Promise<EmailServiceResponse> {
    const maxRetries = 2;
    
    try {
      logger.debug('Sending email', { to, subject, attempt: retryCount + 1 });
      
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { to, subject, html, text }
      });

      if (error) {
        logger.error('Email service error', { error, to, attempt: retryCount + 1 });
        
        // Retry logic for transient failures
        if (retryCount < maxRetries && this.isRetryableError(error)) {
          logger.info('Retrying email send', { attempt: retryCount + 2 });
          await this.delay(1000 * (retryCount + 1)); // Exponential backoff
          return this.sendEmail(to, subject, html, text, retryCount + 1);
        }
        
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        logger.error('Email sending failed', { error: data?.error, to, attempt: retryCount + 1 });
        
        // Retry logic for API failures
        if (retryCount < maxRetries && this.isRetryableError(data?.error)) {
          logger.info('Retrying email send', { attempt: retryCount + 2 });
          await this.delay(1000 * (retryCount + 1));
          return this.sendEmail(to, subject, html, text, retryCount + 1);
        }
        
        return { success: false, error: data?.error || 'Failed to send email' };
      }

      logger.info('Email sent successfully', { to });
      return { success: true };
    } catch (error: any) {
      logger.error('Email service exception', { error, to, attempt: retryCount + 1 });
      
      // Retry logic for network errors
      if (retryCount < maxRetries) {
        logger.info('Retrying email send after exception', { attempt: retryCount + 2 });
        await this.delay(1000 * (retryCount + 1));
        return this.sendEmail(to, subject, html, text, retryCount + 1);
      }
      
      return { success: false, error: error.message };
    }
  }

  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const errorMessage = typeof error === 'string' ? error : error.message || '';
    const retryableErrors = [
      'network',
      'timeout',
      'temporary',
      'rate limit',
      'service unavailable',
      'internal server error'
    ];
    
    return retryableErrors.some(retryableError => 
      errorMessage.toLowerCase().includes(retryableError)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sendContactConfirmation(name: string, email: string, subject: string, message: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.contactConfirmation({ name, email, subject, message });
    return this.sendEmail(email, template.subject, template.html, template.text);
  }

  async sendContactAdminNotification(name: string, email: string, subject: string, message: string, adminEmail: string = 'info@jojoprompts.com'): Promise<EmailServiceResponse> {
    const template = emailTemplates.contactAdminNotification({ name, email, subject, message });
    return this.sendEmail(adminEmail, template.subject, template.html, template.text);
  }

  async sendWelcomeEmail(name: string, email: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.welcome({ name, email });
    return this.sendEmail(email, template.subject, template.html, template.text);
  }

  async sendPasswordResetEmail(name: string, email: string, resetLink: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.passwordReset({ name, resetLink });
    return this.sendEmail(email, template.subject, template.html, template.text);
  }

  // Enhanced payment confirmation with better logging
  async sendPaymentConfirmation(name: string, email: string, planName: string, amount: number, transactionId: string): Promise<EmailServiceResponse> {
    logger.info('Preparing payment confirmation email', { 
      email, 
      name, 
      planName, 
      amount, 
      transactionId 
    });
    
    const template = emailTemplates.paymentConfirmation({ name, planName, amount, transactionId });
    const result = await this.sendEmail(email, template.subject, template.html, template.text);
    
    if (result.success) {
      logger.info('Payment confirmation email sent successfully', { email });
    } else {
      logger.error('Payment confirmation email failed', { email, error: result.error });
    }
    
    return result;
  }

  async sendSubscriptionCancelled(name: string, email: string, planName: string, endDate: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.subscriptionCancelled({ name, planName, endDate });
    return this.sendEmail(email, template.subject, template.html, template.text);
  }

  async sendPaymentFailed(name: string, email: string, planName: string, reason: string, retryLink: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.paymentFailed({ name, planName, reason, retryLink });
    return this.sendEmail(email, template.subject, template.html, template.text);
  }

  async sendAccountDeleted(name: string, email: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.accountDeleted({ name });
    return this.sendEmail(email, template.subject, template.html, template.text);
  }

  async sendEmailConfirmation(name: string, email: string, confirmationLink: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.emailConfirmation({ name, email, confirmationLink });
    return this.sendEmail(email, template.subject, template.html, template.text);
  }
}

export const emailService = new EmailService();


import { supabase } from "@/integrations/supabase/client";
import { emailTemplates } from "./emailTemplates";

interface EmailServiceResponse {
  success: boolean;
  error?: string;
}

class EmailService {
  private async sendEmail(to: string, subject: string, html: string, text?: string, retryCount = 0): Promise<EmailServiceResponse> {
    const maxRetries = 2;
    
    try {
      console.log(`[EmailService] Sending email to ${to} with subject: ${subject} (attempt ${retryCount + 1})`);
      
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { to, subject, html, text }
      });

      if (error) {
        console.error(`[EmailService] Email service error (attempt ${retryCount + 1}):`, error);
        
        // Retry logic for transient failures
        if (retryCount < maxRetries && this.isRetryableError(error)) {
          console.log(`[EmailService] Retrying email send (attempt ${retryCount + 2})`);
          await this.delay(1000 * (retryCount + 1)); // Exponential backoff
          return this.sendEmail(to, subject, html, text, retryCount + 1);
        }
        
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        console.error(`[EmailService] Email sending failed (attempt ${retryCount + 1}):`, data?.error);
        
        // Retry logic for API failures
        if (retryCount < maxRetries && this.isRetryableError(data?.error)) {
          console.log(`[EmailService] Retrying email send (attempt ${retryCount + 2})`);
          await this.delay(1000 * (retryCount + 1));
          return this.sendEmail(to, subject, html, text, retryCount + 1);
        }
        
        return { success: false, error: data?.error || 'Failed to send email' };
      }

      console.log(`[EmailService] Email sent successfully to ${to}`);
      return { success: true };
    } catch (error: any) {
      console.error(`[EmailService] Email service exception (attempt ${retryCount + 1}):`, error);
      
      // Retry logic for network errors
      if (retryCount < maxRetries) {
        console.log(`[EmailService] Retrying email send after exception (attempt ${retryCount + 2})`);
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
    console.log(`[EmailService] Preparing payment confirmation email for ${email}:`, {
      name,
      planName,
      amount,
      transactionId
    });
    
    const template = emailTemplates.paymentConfirmation({ name, planName, amount, transactionId });
    const result = await this.sendEmail(email, template.subject, template.html, template.text);
    
    if (result.success) {
      console.log(`[EmailService] Payment confirmation email sent successfully to ${email}`);
    } else {
      console.error(`[EmailService] Payment confirmation email failed for ${email}:`, result.error);
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
}

export const emailService = new EmailService();

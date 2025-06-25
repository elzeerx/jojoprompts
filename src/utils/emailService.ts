
import { supabase } from "@/integrations/supabase/client";
import { emailTemplates } from "./emailTemplates";

interface EmailServiceResponse {
  success: boolean;
  error?: string;
}

class EmailService {
  private async sendEmail(to: string, subject: string, html: string, text?: string): Promise<EmailServiceResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { to, subject, html, text }
      });

      if (error) {
        console.error('Email service error:', error);
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        console.error('Email sending failed:', data?.error);
        return { success: false, error: data?.error || 'Failed to send email' };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Email service exception:', error);
      return { success: false, error: error.message };
    }
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

  // NEW: Payment and subscription email methods
  async sendPaymentConfirmation(name: string, email: string, planName: string, amount: number, transactionId: string): Promise<EmailServiceResponse> {
    const template = emailTemplates.paymentConfirmation({ name, planName, amount, transactionId });
    return this.sendEmail(email, template.subject, template.html, template.text);
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

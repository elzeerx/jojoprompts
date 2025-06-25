
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
}

export const emailService = new EmailService();

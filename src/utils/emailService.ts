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

  async sendPaymentConfirmation(
    name: string, 
    email: string, 
    planName: string, 
    amount: number, 
    paymentId: string, 
    subscriptionEndDate?: string
  ): Promise<EmailServiceResponse> {
    const template = emailTemplates.paymentConfirmation({ 
      name, 
      email, 
      planName, 
      amount, 
      paymentId, 
      subscriptionEndDate 
    });
    return this.sendEmail(email, template.subject, template.html, template.text);
  }

  async sendSubscriptionActivation(
    name: string,
    email: string,
    planName: string,
    subscriptionEndDate: string,
    amount: number,
    paymentMethod: string
  ): Promise<EmailServiceResponse> {
    const template = emailTemplates.subscriptionActivation({
      name,
      email,
      planName,
      subscriptionEndDate,
      amount,
      paymentMethod
    });
    return this.sendEmail(email, template.subject, template.html, template.text);
  }

  async sendInvoiceReceipt(
    name: string,
    email: string,
    invoiceNumber: string,
    planName: string,
    amount: number,
    paymentDate: string,
    paymentMethod: string,
    billingPeriod: string
  ): Promise<EmailServiceResponse> {
    const template = emailTemplates.invoiceReceipt({
      name,
      email,
      invoiceNumber,
      planName,
      amount,
      paymentDate,
      paymentMethod,
      billingPeriod
    });
    return this.sendEmail(email, template.subject, template.html, template.text);
  }

  async sendSubscriptionStatusChange(
    name: string, 
    email: string, 
    planName: string, 
    statusChange: 'cancelled' | 'suspended' | 'reactivated' | 'expired',
    effectiveDate: string,
    reason?: string
  ): Promise<EmailServiceResponse> {
    const template = emailTemplates.subscriptionStatusChange({ 
      name, 
      email, 
      planName, 
      statusChange, 
      effectiveDate, 
      reason 
    });
    return this.sendEmail(email, template.subject, template.html, template.text);
  }

  async sendAccountUpgrade(
    name: string,
    email: string,
    fromPlan: string,
    toPlan: string,
    upgradeDate: string,
    newFeatures: string[]
  ): Promise<EmailServiceResponse> {
    const template = emailTemplates.accountUpgrade({
      name,
      email,
      fromPlan,
      toPlan,
      upgradeDate,
      newFeatures
    });
    return this.sendEmail(email, template.subject, template.html, template.text);
  }

  async sendRenewalReminder(
    name: string,
    email: string,
    planName: string,
    expirationDate: string,
    daysUntilExpiration: number,
    renewalUrl: string
  ): Promise<EmailServiceResponse> {
    const template = emailTemplates.renewalReminder({
      name,
      email,
      planName,
      expirationDate,
      daysUntilExpiration,
      renewalUrl
    });
    return this.sendEmail(email, template.subject, template.html, template.text);
  }
}

export const emailService = new EmailService();

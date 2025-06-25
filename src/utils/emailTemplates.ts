interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

interface ContactEmailData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

interface WelcomeEmailData {
  name: string;
  email: string;
}

interface PasswordResetEmailData {
  name: string;
  resetLink: string;
}

interface PaymentConfirmationData {
  name: string;
  email: string;
  planName: string;
  amount: number;
  paymentId: string;
  subscriptionEndDate?: string;
}

interface SubscriptionActivationData {
  name: string;
  email: string;
  planName: string;
  subscriptionEndDate: string;
  amount: number;
  paymentMethod: string;
}

interface InvoiceReceiptData {
  name: string;
  email: string;
  invoiceNumber: string;
  planName: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  billingPeriod: string;
}

export const emailTemplates = {
  // Contact form confirmation email to user
  contactConfirmation: (data: ContactEmailData): EmailTemplate => ({
    subject: "We received your message - JoJo Prompts",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #c49d68 0%, #b8935a 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Thank You, ${data.name}!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">We've received your message</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Your Message Details</h2>
          
          <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #c49d68;">
            <p style="margin: 0 0 10px 0; color: #666;"><strong>Subject:</strong> ${data.subject}</p>
            <p style="margin: 0 0 10px 0; color: #666;"><strong>Email:</strong> ${data.email}</p>
            <div style="margin: 15px 0 0 0;">
              <strong style="color: #333;">Message:</strong>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 10px 0; border: 1px solid #e9ecef;">
                ${data.message.replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
          
          <p style="color: #666; margin: 20px 0; line-height: 1.6;">
            We typically respond within 24 hours during business days. If your inquiry is urgent, 
            please don't hesitate to reach out to us directly.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="mailto:info@jojoprompts.com" style="background: #c49d68; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Contact Support Directly
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin: 20px 0; padding: 20px; color: #666; font-size: 14px;">
          <p style="margin: 0;">Best regards,<br><strong>The JoJo Prompts Team</strong></p>
          <div style="margin: 15px 0; padding: 15px 0; border-top: 1px solid #e9ecef;">
            <p style="margin: 0;">© 2024 JoJo Prompts. All rights reserved.</p>
          </div>
        </div>
      </div>
    `,
    text: `Thank you for contacting us, ${data.name}!\n\nWe have received your message about "${data.subject}" and will get back to you as soon as possible.\n\nYour message:\n${data.message}\n\nBest regards,\nThe JoJo Prompts Team`
  }),

  // Admin notification email for contact form
  contactAdminNotification: (data: ContactEmailData): EmailTemplate => ({
    subject: `New Contact Form Submission from ${data.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🔔 New Contact Form Submission</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <div style="background: white; padding: 20px; border-radius: 6px; border: 1px solid #dee2e6;">
            <h2 style="color: #333; margin: 0 0 20px 0;">Contact Details</h2>
            <p><strong>Name:</strong> ${data.name}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Subject:</strong> ${data.subject}</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #dee2e6;">
            <h3 style="color: #333; margin: 20px 0 10px 0;">Message:</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 4px; border: 1px solid #e9ecef;">
              ${data.message.replace(/\n/g, '<br>')}
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="mailto:${data.email}?subject=Re: ${data.subject}" style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Reply to ${data.name}
            </a>
          </div>
        </div>
      </div>
    `,
    text: `New contact form submission\n\nName: ${data.name}\nEmail: ${data.email}\nSubject: ${data.subject}\n\nMessage:\n${data.message}`
  }),

  // Welcome email for new users
  welcome: (data: WelcomeEmailData): EmailTemplate => ({
    subject: "Welcome to JoJo Prompts! 🎉",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #c49d68 0%, #b8935a 100%); color: white; padding: 40px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 32px;">Welcome to JoJo Prompts!</h1>
          <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">Your journey to better AI prompts starts here</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Hi ${data.name}! 👋</h2>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            Thank you for joining JoJo Prompts! We're excited to help you discover and create amazing AI prompts 
            that will enhance your productivity and creativity.
          </p>
          
          <div style="background: white; padding: 25px; border-radius: 8px; margin: 30px 0; border: 1px solid #dee2e6;">
            <h3 style="color: #333; margin: 0 0 15px 0;">🚀 Getting Started</h3>
            <ul style="color: #666; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li>Browse our curated collection of premium prompts</li>
              <li>Create and organize your own prompt collections</li>
              <li>Discover prompts for ChatGPT, Midjourney, and workflows</li>
              <li>Save your favorites for quick access</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://jojoprompts.com/prompts" style="background: #c49d68; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Explore Prompts Now
            </a>
          </div>
          
          <p style="color: #666; text-align: center; margin: 30px 0; font-size: 14px;">
            Need help? Reply to this email or contact our support team at info@jojoprompts.com
          </p>
        </div>
        
        <div style="text-align: center; margin: 20px 0; padding: 20px; color: #666; font-size: 14px;">
          <p style="margin: 0;">Happy prompting!<br><strong>The JoJo Prompts Team</strong></p>
        </div>
      </div>
    `,
    text: `Welcome to JoJo Prompts, ${data.name}!\n\nThank you for joining our community. Start exploring amazing AI prompts at https://jojoprompts.com/prompts\n\nHappy prompting!\nThe JoJo Prompts Team`
  }),

  // Password reset email
  passwordReset: (data: PasswordResetEmailData): EmailTemplate => ({
    subject: "Reset Your Password - JoJo Prompts",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc3545; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">🔒 Password Reset</h1>
          <p style="margin: 15px 0 0 0; font-size: 16px; opacity: 0.9;">Reset your JoJo Prompts password</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Hi ${data.name},</h2>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            We received a request to reset your password for your JoJo Prompts account. 
            If you didn't make this request, you can safely ignore this email.
          </p>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #856404; font-weight: bold;">⚡ This link will expire in 24 hours</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetLink}" style="background: #dc3545; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Reset My Password
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 30px 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <span style="word-break: break-all; color: #007bff;">${data.resetLink}</span>
          </p>
          
          <div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 6px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #0c5460; font-size: 14px;">
              <strong>Security tip:</strong> Never share this link with anyone. If you didn't request this reset, 
              please contact our support team at info@jojoprompts.com immediately.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin: 20px 0; padding: 20px; color: #666; font-size: 14px;">
          <p style="margin: 0;">Stay secure,<br><strong>The JoJo Prompts Team</strong></p>
        </div>
      </div>
    `,
    text: `Password Reset - JoJo Prompts\n\nHi ${data.name},\n\nWe received a request to reset your password. Click the link below to reset it:\n\n${data.resetLink}\n\nThis link will expire in 24 hours. If you didn't request this reset, please ignore this email.\n\nStay secure,\nThe JoJo Prompts Team`
  }),

  // Payment confirmation email
  paymentConfirmation: (data: PaymentConfirmationData): EmailTemplate => ({
    subject: "Payment Confirmed - Welcome to JoJo Prompts Premium! 🎉",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #c49d68 0%, #b8935a 100%); color: white; padding: 40px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 32px;">Payment Confirmed! 🎉</h1>
          <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">Welcome to ${data.planName}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Hi ${data.name}! 👋</h2>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            Your payment has been successfully processed! You now have full access to all ${data.planName} features.
          </p>
          
          <div style="background: white; padding: 25px; border-radius: 8px; margin: 30px 0; border: 1px solid #dee2e6;">
            <h3 style="color: #333; margin: 0 0 15px 0;">🧾 Payment Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 10px 0; font-weight: bold; color: #666;">Plan:</td>
                <td style="padding: 10px 0; text-align: right; color: #333;">${data.planName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 10px 0; font-weight: bold; color: #666;">Amount:</td>
                <td style="padding: 10px 0; text-align: right; color: #333;">$${data.amount.toFixed(2)} USD</td>
              </tr>
              <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 10px 0; font-weight: bold; color: #666;">Payment ID:</td>
                <td style="padding: 10px 0; text-align: right; color: #333; font-family: monospace; font-size: 12px;">${data.paymentId}</td>
              </tr>
              ${data.subscriptionEndDate ? `
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #666;">Access Until:</td>
                <td style="padding: 10px 0; text-align: right; color: #333;">${new Date(data.subscriptionEndDate).toLocaleDateString()}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          <div style="background: #e8f5e8; border: 1px solid #4caf50; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #2e7d32; margin: 0 0 10px 0;">✅ What's Next?</h3>
            <ul style="color: #2e7d32; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li>Access all premium prompts and collections</li>
              <li>Create unlimited custom prompt collections</li>
              <li>Get priority support and updates</li>
              <li>Enjoy all ${data.planName} exclusive features</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://jojoprompts.com/prompts" style="background: #c49d68; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Start Exploring Premium Prompts
            </a>
          </div>
          
          <p style="color: #666; text-align: center; margin: 30px 0; font-size: 14px;">
            Need help? Contact our support team at info@jojoprompts.com
          </p>
        </div>
        
        <div style="text-align: center; margin: 20px 0; padding: 20px; color: #666; font-size: 14px;">
          <p style="margin: 0;">Welcome to the premium experience!<br><strong>The JoJo Prompts Team</strong></p>
        </div>
      </div>
    `,
    text: `Payment Confirmed - Welcome to JoJo Prompts Premium!\n\nHi ${data.name}!\n\nYour payment has been successfully processed! You now have full access to all ${data.planName} features.\n\nPayment Details:\nPlan: ${data.planName}\nAmount: $${data.amount.toFixed(2)} USD\nPayment ID: ${data.paymentId}\n\nStart exploring: https://jojoprompts.com/prompts\n\nWelcome to the premium experience!\nThe JoJo Prompts Team`
  }),

  // Subscription activation email
  subscriptionActivation: (data: SubscriptionActivationData): EmailTemplate => ({
    subject: `Your ${data.planName} Subscription is Now Active! 🚀`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 40px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 32px;">Subscription Activated! 🚀</h1>
          <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">Your ${data.planName} is ready to use</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Hi ${data.name}! 🎉</h2>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            Great news! Your ${data.planName} subscription has been successfully activated and is now ready to use.
          </p>
          
          <div style="background: white; padding: 25px; border-radius: 8px; margin: 30px 0; border: 1px solid #dee2e6;">
            <h3 style="color: #333; margin: 0 0 15px 0;">📋 Subscription Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 10px 0; font-weight: bold; color: #666;">Plan:</td>
                <td style="padding: 10px 0; text-align: right; color: #333;">${data.planName}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 10px 0; font-weight: bold; color: #666;">Amount Paid:</td>
                <td style="padding: 10px 0; text-align: right; color: #333;">$${data.amount.toFixed(2)} USD</td>
              </tr>
              <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 10px 0; font-weight: bold; color: #666;">Payment Method:</td>
                <td style="padding: 10px 0; text-align: right; color: #333;">${data.paymentMethod}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: bold; color: #666;">Valid Until:</td>
                <td style="padding: 10px 0; text-align: right; color: #333;">${new Date(data.subscriptionEndDate).toLocaleDateString()}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #856404; margin: 0 0 10px 0;">🎯 Your Premium Benefits</h3>
            <ul style="color: #856404; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li>Unlimited access to all premium prompt collections</li>
              <li>Create and organize custom prompt libraries</li>
              <li>Priority customer support</li>
              <li>Early access to new features and prompts</li>
              <li>Export and share capabilities</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://jojoprompts.com/prompts" style="background: #28a745; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; margin-right: 10px;">
              Explore Premium Content
            </a>
            <a href="https://jojoprompts.com/account" style="background: #6c757d; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Manage Subscription
            </a>
          </div>
          
          <p style="color: #666; text-align: center; margin: 30px 0; font-size: 14px;">
            Questions? Reach out to us at info@jojoprompts.com
          </p>
        </div>
        
        <div style="text-align: center; margin: 20px 0; padding: 20px; color: #666; font-size: 14px;">
          <p style="margin: 0;">Happy prompting!<br><strong>The JoJo Prompts Team</strong></p>
        </div>
      </div>
    `,
    text: `Your ${data.planName} Subscription is Now Active!\n\nHi ${data.name}!\n\nGreat news! Your ${data.planName} subscription has been successfully activated.\n\nSubscription Details:\nPlan: ${data.planName}\nAmount Paid: $${data.amount.toFixed(2)} USD\nPayment Method: ${data.paymentMethod}\nValid Until: ${new Date(data.subscriptionEndDate).toLocaleDateString()}\n\nExplore premium content: https://jojoprompts.com/prompts\n\nHappy prompting!\nThe JoJo Prompts Team`
  }),

  // Invoice/Receipt email
  invoiceReceipt: (data: InvoiceReceiptData): EmailTemplate => ({
    subject: `Invoice #${data.invoiceNumber} - JoJo Prompts`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #6c757d; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">Invoice Receipt 📄</h1>
          <p style="margin: 15px 0 0 0; font-size: 16px; opacity: 0.9;">Thank you for your payment</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
            <div>
              <h2 style="color: #333; margin: 0;">Invoice #${data.invoiceNumber}</h2>
              <p style="color: #666; margin: 5px 0 0 0;">Date: ${data.paymentDate}</p>
            </div>
            <div style="text-align: right;">
              <strong style="color: #c49d68; font-size: 24px;">$${data.amount.toFixed(2)}</strong>
              <p style="color: #666; margin: 5px 0 0 0;">USD</p>
            </div>
          </div>
          
          <div style="background: white; padding: 25px; border-radius: 8px; margin: 30px 0; border: 1px solid #dee2e6;">
            <h3 style="color: #333; margin: 0 0 20px 0; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">📋 Invoice Details</h3>
            
            <div style="margin-bottom: 20px;">
              <h4 style="color: #666; margin: 0 0 10px 0;">Bill To:</h4>
              <p style="margin: 0; color: #333; font-weight: bold;">${data.name}</p>
              <p style="margin: 0; color: #666;">${data.email}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                  <th style="padding: 12px; text-align: left; color: #666; font-weight: bold;">Description</th>
                  <th style="padding: 12px; text-align: right; color: #666; font-weight: bold;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 12px; color: #333;">
                    <strong>${data.planName}</strong><br>
                    <small style="color: #666;">Billing Period: ${data.billingPeriod}</small>
                  </td>
                  <td style="padding: 12px; text-align: right; color: #333; font-weight: bold;">$${data.amount.toFixed(2)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr style="background: #f8f9fa; border-top: 2px solid #dee2e6;">
                  <td style="padding: 12px; font-weight: bold; color: #333;">Total</td>
                  <td style="padding: 12px; text-align: right; font-weight: bold; color: #c49d68; font-size: 18px;">$${data.amount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
              <p style="margin: 0; color: #666; font-size: 14px;"><strong>Payment Method:</strong> ${data.paymentMethod}</p>
              <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;"><strong>Payment Date:</strong> ${data.paymentDate}</p>
            </div>
          </div>
          
          <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #155724; font-weight: bold;">✅ Payment Status: PAID</p>
            <p style="margin: 10px 0 0 0; color: #155724; font-size: 14px;">
              Your payment has been successfully processed and your subscription is active.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://jojoprompts.com/account" style="background: #6c757d; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
              Download Invoice PDF
            </a>
          </div>
          
          <p style="color: #666; text-align: center; margin: 30px 0; font-size: 14px;">
            Questions about this invoice? Contact us at info@jojoprompts.com
          </p>
        </div>
        
        <div style="text-align: center; margin: 20px 0; padding: 20px; color: #666; font-size: 12px;">
          <p style="margin: 0;">JoJo Prompts<br>Invoice #${data.invoiceNumber}</p>
          <p style="margin: 10px 0 0 0;">This is an automated receipt for your records.</p>
        </div>
      </div>
    `,
    text: `Invoice #${data.invoiceNumber} - JoJo Prompts\n\nThank you for your payment!\n\nBill To: ${data.name} (${data.email})\n\nDescription: ${data.planName}\nBilling Period: ${data.billingPeriod}\nAmount: $${data.amount.toFixed(2)} USD\n\nPayment Method: ${data.paymentMethod}\nPayment Date: ${data.paymentDate}\n\nPayment Status: PAID\n\nQuestions? Contact us at info@jojoprompts.com\n\nJoJo Prompts`
  })
};

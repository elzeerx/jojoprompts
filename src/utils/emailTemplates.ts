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

interface PaymentConfirmationEmailData {
  name: string;
  planName: string;
  amount: number;
  transactionId: string;
}

interface SubscriptionCancelledEmailData {
  name: string;
  planName: string;
  endDate: string;
}

interface PaymentFailedEmailData {
  name: string;
  planName: string;
  reason: string;
  retryLink: string;
}

interface AccountDeletedEmailData {
  name: string;
}

export interface EmailConfirmationData {
  name: string;
  email: string;
  confirmationLink: string;
}

export const emailTemplates = {
  // Contact form confirmation email to user
  contactConfirmation: (data: ContactEmailData): EmailTemplate => ({
    subject: "We received your message - JoJo Prompts",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #c49d68 0%, #b8935a 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <img src="https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/object/public/storage.bucket/jojo-prompts-logo.png" alt="JoJo Prompts" style="max-height: 60px; margin-bottom: 15px;" />
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
        
        <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 12px;">
          <p style="margin: 0 0 10px 0;">
            <a href="https://jojoprompts.com/unsubscribe?email=${data.email}&type=contact_confirmation" style="color: #666;">Unsubscribe</a> | 
            <a href="https://jojoprompts.com/privacy" style="color: #666;">Privacy Policy</a>
          </p>
          <p style="margin: 0;">
            JoJo Prompts<br>
            Part of Recipe Group,<br>
            Abdullah Al Mubarak St, Humaidhiyah Tower.<br>
            Murqab, Kuwait City 15001
          </p>
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
        <div style="background: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <img src="https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/object/public/storage.bucket/jojo-prompts-logo.png" alt="JoJo Prompts" style="max-height: 50px; margin-bottom: 10px; filter: brightness(0) invert(1);" />
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
    subject: "Welcome to JoJo Prompts! Your AI Prompt Journey Starts Now",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #c49d68 0%, #b8935a 100%); color: white; padding: 40px; border-radius: 8px 8px 0 0; text-align: center;">
          <img src="https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/object/public/storage.bucket/jojo-prompts-logo.png" alt="JoJo Prompts" style="max-height: 80px; margin-bottom: 20px;" />
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
        
        <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 12px;">
          <p style="margin: 0 0 10px 0;">
            <a href="https://jojoprompts.com/unsubscribe?email=${data.email}&type=welcome" style="color: #666;">Unsubscribe</a> | 
            <a href="https://jojoprompts.com/privacy" style="color: #666;">Privacy Policy</a>
          </p>
          <p style="margin: 0;">
            JoJo Prompts<br>
            Part of Recipe Group,<br>
            Abdullah Al Mubarak St, Humaidhiyah Tower.<br>
            Murqab, Kuwait City 15001
          </p>
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
          <img src="https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/object/public/storage.bucket/jojo-prompts-logo.png" alt="JoJo Prompts" style="max-height: 60px; margin-bottom: 15px; filter: brightness(0) invert(1);" />
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
        
        <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 12px;">
          <p style="margin: 0 0 10px 0;">
            <a href="https://jojoprompts.com/unsubscribe?email={{email}}&type=password_reset" style="color: #666;">Unsubscribe</a> | 
            <a href="https://jojoprompts.com/privacy" style="color: #666;">Privacy Policy</a>
          </p>
          <p style="margin: 0;">
            JoJo Prompts<br>
            Part of Recipe Group,<br>
            Abdullah Al Mubarak St, Humaidhiyah Tower.<br>
            Murqab, Kuwait City 15001
          </p>
        </div>
      </div>
    `,
    text: `Password Reset - JoJo Prompts\n\nHi ${data.name},\n\nWe received a request to reset your password. Click the link below to reset it:\n\n${data.resetLink}\n\nThis link will expire in 24 hours. If you didn't request this reset, please ignore this email.\n\nStay secure,\nThe JoJo Prompts Team`
  }),

  // Payment confirmation email
  paymentConfirmation: (data: PaymentConfirmationEmailData): EmailTemplate => ({
    subject: "Payment Confirmed - Welcome to Premium Access",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 40px; border-radius: 8px 8px 0 0; text-align: center;">
          <img src="https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/object/public/storage.bucket/jojo-prompts-logo.png" alt="JoJo Prompts" style="max-height: 80px; margin-bottom: 20px;" />
          <h1 style="margin: 0; font-size: 32px;">Payment Confirmed! 🎉</h1>
          <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">Welcome to JoJo Prompts Premium</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Hi ${data.name}! 👋</h2>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            Your payment has been successfully processed! You now have access to all premium features.
          </p>
          
          <div style="background: white; padding: 25px; border-radius: 8px; margin: 30px 0; border: 1px solid #dee2e6;">
            <h3 style="color: #333; margin: 0 0 15px 0;">Payment Details</h3>
            <p style="margin: 5px 0; color: #666;"><strong>Plan:</strong> ${data.planName}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Amount:</strong> $${data.amount.toFixed(2)} USD</p>
            <p style="margin: 5px 0; color: #666;"><strong>Transaction ID:</strong> ${data.transactionId}</p>
          </div>
          
          <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #155724; margin: 0 0 10px 0;">🚀 You now have access to:</h3>
            <ul style="color: #155724; margin: 0; padding-left: 20px;">
              <li>Unlimited premium prompts</li>
              <li>Advanced search and filtering</li>
              <li>Priority customer support</li>
              <li>Exclusive prompt collections</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://jojoprompts.com/prompts" style="background: #28a745; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Start Using Premium Features
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin: 20px 0; padding: 20px; color: #666; font-size: 14px;">
          <p style="margin: 0;">Thank you for your purchase!<br><strong>The JoJo Prompts Team</strong></p>
        </div>
        
        <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 12px;">
          <p style="margin: 0 0 10px 0;">
            <a href="https://jojoprompts.com/unsubscribe?email={{email}}&type=payment_confirmation" style="color: #666;">Unsubscribe</a> | 
            <a href="https://jojoprompts.com/privacy" style="color: #666;">Privacy Policy</a>
          </p>
          <p style="margin: 0;">
            JoJo Prompts<br>
            Part of Recipe Group,<br>
            Abdullah Al Mubarak St, Humaidhiyah Tower.<br>
            Murqab, Kuwait City 15001
          </p>
        </div>
      </div>
    `,
    text: `Payment Confirmed - JoJo Prompts\n\nHi ${data.name}!\n\nYour payment has been successfully processed!\n\nPlan: ${data.planName}\nAmount: $${data.amount.toFixed(2)} USD\nTransaction ID: ${data.transactionId}\n\nStart using your premium features at https://jojoprompts.com/prompts\n\nThank you!\nThe JoJo Prompts Team`
  }),

  // Subscription cancelled email
  subscriptionCancelled: (data: SubscriptionCancelledEmailData): EmailTemplate => ({
    subject: "Subscription Cancelled - JoJo Prompts",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #6c757d; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <img src="https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/object/public/storage.bucket/jojo-prompts-logo.png" alt="JoJo Prompts" style="max-height: 60px; margin-bottom: 15px; filter: brightness(0) invert(1);" />
          <h1 style="margin: 0; font-size: 28px;">Subscription Cancelled</h1>
          <p style="margin: 15px 0 0 0; font-size: 16px; opacity: 0.9;">We're sorry to see you go</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Hi ${data.name},</h2>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            Your subscription to ${data.planName} has been cancelled as requested.
          </p>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>Important:</strong> You'll continue to have access to premium features until ${data.endDate}.
            </p>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            We'd love to have you back anytime! If you have any feedback about your experience or suggestions for improvement, please don't hesitate to reach out.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://jojoprompts.com/pricing" style="background: #c49d68; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Reactivate Subscription
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin: 20px 0; padding: 20px; color: #666; font-size: 14px;">
          <p style="margin: 0;">Thank you for being part of our community!<br><strong>The JoJo Prompts Team</strong></p>
        </div>
        
        <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 12px;">
          <p style="margin: 0 0 10px 0;">
            <a href="https://jojoprompts.com/unsubscribe?email={{email}}&type=subscription_cancelled" style="color: #666;">Unsubscribe</a> | 
            <a href="https://jojoprompts.com/privacy" style="color: #666;">Privacy Policy</a>
          </p>
          <p style="margin: 0;">
            JoJo Prompts<br>
            Part of Recipe Group,<br>
            Abdullah Al Mubarak St, Humaidhiyah Tower.<br>
            Murqab, Kuwait City 15001
          </p>
        </div>
      </div>
    `,
    text: `Subscription Cancelled - JoJo Prompts\n\nHi ${data.name},\n\nYour subscription to ${data.planName} has been cancelled.\n\nYou'll continue to have access until ${data.endDate}.\n\nWe'd love to have you back! Visit https://jojoprompts.com/pricing to reactivate.\n\nThank you!\nThe JoJo Prompts Team`
  }),

  // Payment failed email
  paymentFailed: (data: PaymentFailedEmailData): EmailTemplate => ({
    subject: "Payment Issue - Action Required",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc3545; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <img src="https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/object/public/storage.bucket/jojo-prompts-logo.png" alt="JoJo Prompts" style="max-height: 60px; margin-bottom: 15px; filter: brightness(0) invert(1);" />
          <h1 style="margin: 0; font-size: 28px;">Payment Issue</h1>
          <p style="margin: 15px 0 0 0; font-size: 16px; opacity: 0.9;">Action required for your subscription</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Hi ${data.name},</h2>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            We encountered an issue processing your payment for ${data.planName}.
          </p>
          
          <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #721c24;">
              <strong>Issue:</strong> ${data.reason}
            </p>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            Don't worry - your account is still active for now. Please update your payment information or try again to continue enjoying premium features.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.retryLink}" style="background: #dc3545; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Update Payment Method
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center; margin: 30px 0;">
            Need help? Contact our support team at info@jojoprompts.com
          </p>
        </div>
        
        <div style="text-align: center; margin: 20px 0; padding: 20px; color: #666; font-size: 14px;">
          <p style="margin: 0;">We're here to help!<br><strong>The JoJo Prompts Team</strong></p>
        </div>
        
        <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 12px;">
          <p style="margin: 0 0 10px 0;">
            <a href="https://jojoprompts.com/unsubscribe?email={{email}}&type=payment_failed" style="color: #666;">Unsubscribe</a> | 
            <a href="https://jojoprompts.com/privacy" style="color: #666;">Privacy Policy</a>
          </p>
          <p style="margin: 0;">
            JoJo Prompts<br>
            Part of Recipe Group,<br>
            Abdullah Al Mubarak St, Humaidhiyah Tower.<br>
            Murqab, Kuwait City 15001
          </p>
        </div>
      </div>
    `,
    text: `Payment Issue - JoJo Prompts\n\nHi ${data.name},\n\nWe encountered an issue processing your payment for ${data.planName}.\n\nIssue: ${data.reason}\n\nPlease update your payment method: ${data.retryLink}\n\nNeed help? Contact us at info@jojoprompts.com\n\nThe JoJo Prompts Team`
  }),

  // Account deleted confirmation
  accountDeleted: (data: AccountDeletedEmailData): EmailTemplate => ({
    subject: "Account Deleted - JoJo Prompts",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #6c757d; color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <img src="https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/object/public/storage.bucket/jojo-prompts-logo.png" alt="JoJo Prompts" style="max-height: 60px; margin-bottom: 15px; filter: brightness(0) invert(1);" />
          <h1 style="margin: 0; font-size: 28px;">Account Deleted</h1>
          <p style="margin: 15px 0 0 0; font-size: 16px; opacity: 0.9;">Your account has been permanently deleted</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0;">Hi ${data.name},</h2>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            Your JoJo Prompts account has been permanently deleted as requested. All your data, including:
          </p>
          
          <ul style="color: #666; line-height: 1.6; margin: 20px 0; padding-left: 20px;">
            <li>Personal information and profile</li>
            <li>Saved prompts and collections</li>
            <li>Subscription history</li>
            <li>Usage data</li>
          </ul>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            has been permanently removed from our systems.
          </p>
          
          <div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 6px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #0c5460;">
              <strong>Note:</strong> This action cannot be undone. If you change your mind, you'll need to create a new account.
            </p>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            Thank you for being part of the JoJo Prompts community. If you have any feedback about your experience, we'd love to hear from you at info@jojoprompts.com.
          </p>
        </div>
        
        <div style="text-align: center; margin: 20px 0; padding: 20px; color: #666; font-size: 14px;">
          <p style="margin: 0;">Goodbye and best wishes!<br><strong>The JoJo Prompts Team</strong></p>
        </div>
        
        <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 12px;">
          <p style="margin: 0 0 10px 0;">
            <a href="https://jojoprompts.com/unsubscribe?email={{email}}&type=account_deleted" style="color: #666;">Unsubscribe</a> | 
            <a href="https://jojoprompts.com/privacy" style="color: #666;">Privacy Policy</a>
          </p>
          <p style="margin: 0;">
            JoJo Prompts<br>
            Part of Recipe Group,<br>
            Abdullah Al Mubarak St, Humaidhiyah Tower.<br>
            Murqab, Kuwait City 15001
          </p>
        </div>
      </div>
    `,
    text: `Account Deleted - JoJo Prompts\n\nHi ${data.name},\n\nYour JoJo Prompts account has been permanently deleted as requested.\n\nAll your data has been removed from our systems. This action cannot be undone.\n\nThank you for being part of our community!\n\nThe JoJo Prompts Team`
  }),

  emailConfirmation: (data: EmailConfirmationData): EmailTemplate => ({
    subject: "Confirm Your Email - JojoPrompts",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #c49d68;">JojoPrompts</h1>
        <h2>Confirm Your Email Address</h2>
        <p>Hi ${data.name},</p>
        <p>Please confirm your email address to complete your registration.</p>
        <a href="${data.confirmationLink}" style="background: #c49d68; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block;">
          Confirm Email Address
        </a>
        <p>If the button doesn't work, copy this link: ${data.confirmationLink}</p>
        
        <div style="text-align: center; margin: 30px 0; padding: 20px; border-top: 1px solid #e9ecef; color: #666; font-size: 12px;">
          <p style="margin: 0 0 10px 0;">
            <a href="https://jojoprompts.com/unsubscribe?email=${data.email}&type=email_confirmation" style="color: #666;">Unsubscribe</a> | 
            <a href="https://jojoprompts.com/privacy" style="color: #666;">Privacy Policy</a>
          </p>
          <p style="margin: 0;">
            JoJo Prompts<br>
            Part of Recipe Group,<br>
            Abdullah Al Mubarak St, Humaidhiyah Tower.<br>
            Murqab, Kuwait City 15001
          </p>
        </div>
      </div>
    `,
    text: `Hi ${data.name},\n\nPlease confirm your email: ${data.confirmationLink}\n\n© 2024 JojoPrompts`
  })
};

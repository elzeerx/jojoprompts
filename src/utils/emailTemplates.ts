
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
  })
};

-- Phase 2: Add Payment Confirmation Email Template (Fixed)
-- Insert payment confirmation template into email_templates table with correct JSONB format

INSERT INTO public.email_templates (slug, name, type, subject, html, text, variables, is_active)
VALUES (
  'payment_confirmation',
  'Payment Confirmation',
  'transactional',
  'Payment Confirmed - Welcome to {{plan_name}}! 🎉',
  '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmed - JoJo Prompts</title>
</head>
<body style="background-color: #f5f5f5; font-family: Arial, sans-serif; margin: 0; padding: 0;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0; padding: 20px;">
    <tr>
      <td>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #c49d68 0%, #7a9e9f 100%); color: white; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 600; letter-spacing: -0.5px;">JoJo Prompts</h1>
              <h2 style="margin: 15px 0 0 0; font-size: 28px; font-weight: 400;">Payment Confirmed! 🎉</h2>
              <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.95;">Welcome to Premium</p>
            </td>
          </tr>
          
          <!-- Main content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #262626; margin: 0 0 20px 0; font-size: 24px;">Hi {{first_name}}! 👋</h2>
              
              <p style="color: #666; line-height: 1.6; margin: 20px 0; font-size: 16px;">
                Your payment has been successfully processed! You now have full access to all premium features and prompts.
              </p>
              
              <!-- Payment details box -->
              <div style="background: #efeee9; padding: 25px; border-radius: 8px; margin: 30px 0;">
                <h3 style="color: #262626; margin: 0 0 15px 0; font-size: 18px;">Payment Details</h3>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding: 8px 0;"><strong style="color: #262626;">Plan:</strong></td>
                    <td style="padding: 8px 0; text-align: right; color: #666;">{{plan_name}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong style="color: #262626;">Amount:</strong></td>
                    <td style="padding: 8px 0; text-align: right; color: #666;">${{amount}} USD</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong style="color: #262626;">Transaction ID:</strong></td>
                    <td style="padding: 8px 0; text-align: right; color: #666; font-family: monospace; font-size: 14px;">{{transaction_id}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;"><strong style="color: #262626;">Date:</strong></td>
                    <td style="padding: 8px 0; text-align: right; color: #666;">{{purchase_date}}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Benefits section -->
              <div style="background: #f8f9fa; border-left: 4px solid #c49d68; padding: 20px; margin: 25px 0; border-radius: 4px;">
                <h3 style="color: #262626; margin: 0 0 15px 0; font-size: 18px;">🚀 You Now Have Access To:</h3>
                <ul style="color: #666; margin: 0; padding-left: 20px; line-height: 1.8;">
                  <li>Unlimited access to premium prompts</li>
                  <li>Advanced search and filtering tools</li>
                  <li>Priority customer support</li>
                  <li>Exclusive prompt collections</li>
                  <li>Early access to new features</li>
                </ul>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="https://jojoprompts.com/prompts" style="background: linear-gradient(135deg, #c49d68 0%, #7a9e9f 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  Start Exploring Premium Prompts →
                </a>
              </div>
              
              <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;">
                Need help getting started? Visit our <a href="https://jojoprompts.com/help" style="color: #c49d68; text-decoration: none;">Help Center</a> or reply to this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">
                Thank you for your purchase!<br>
                <strong>The JoJo Prompts Team</strong>
              </p>
              
              <p style="color: #999; margin: 15px 0 0 0; font-size: 12px;">
                Questions? Contact us at <a href="mailto:info@jojoprompts.com" style="color: #c49d68; text-decoration: none;">info@jojoprompts.com</a>
              </p>
              
              <p style="color: #999; margin: 15px 0 0 0; font-size: 11px;">
                JoJo Prompts, Part of Recipe Group<br>
                Abdullah Al Mubarak St, Humaidhiyah Tower<br>
                Murqab, Kuwait City 15001
              </p>
              
              <p style="margin: 15px 0 0 0; font-size: 11px;">
                <a href="{{unsubscribe_link}}" style="color: #999; text-decoration: none;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  'Payment Confirmed - JoJo Prompts

Hi {{first_name}}!

Your payment has been successfully processed! You now have full access to all premium features.

Payment Details:
- Plan: {{plan_name}}
- Amount: ${{amount}} USD
- Transaction ID: {{transaction_id}}
- Date: {{purchase_date}}

You Now Have Access To:
✓ Unlimited access to premium prompts
✓ Advanced search and filtering tools
✓ Priority customer support
✓ Exclusive prompt collections
✓ Early access to new features

Start exploring: https://jojoprompts.com/prompts

Need help? Contact us at info@jojoprompts.com

Thank you for your purchase!
The JoJo Prompts Team

---
JoJo Prompts, Part of Recipe Group
Abdullah Al Mubarak St, Humaidhiyah Tower
Murqab, Kuwait City 15001

Unsubscribe: {{unsubscribe_link}}',
  '{"first_name":"User","plan_name":"Premium Plan","amount":"0.00","transaction_id":"","purchase_date":"","unsubscribe_link":""}'::jsonb,
  true
)
ON CONFLICT (slug) 
DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  subject = EXCLUDED.subject,
  html = EXCLUDED.html,
  text = EXCLUDED.text,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = now();
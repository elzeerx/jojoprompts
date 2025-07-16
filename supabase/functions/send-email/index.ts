import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { Resend } from 'npm:resend@2.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// Email templates
const emailTemplates = {
  emailConfirmation: (data: { name: string; email: string; confirmationLink: string }) => ({
    subject: "Confirm Your Email Address - JoJo Prompts",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>Confirm Your Email - JoJo Prompts</title>
</head>
<body style="background-color: #f6f6f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.4; margin: 0; padding: 0; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="body" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f6f6f6; width: 100%;" width="100%" bgcolor="#f6f6f6">
    <tr>
      <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; vertical-align: top;" valign="top">&nbsp;</td>
      <td class="container" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; vertical-align: top; display: block; max-width: 580px; padding: 10px; width: 580px; margin: 0 auto;" width="580" valign="top">
        <div class="content" style="box-sizing: border-box; display: block; margin: 0 auto; max-width: 580px; padding: 10px;">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #c49d68 0%, #b8935a 100%); color: white; padding: 40px 30px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 32px; font-weight: 600; line-height: 1.2; color: #ffffff; letter-spacing: -0.5px;">JoJo Prompts</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; color: #ffffff; font-weight: 300;">Confirm Your Email Address</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8; color: #ffffff;">Complete your registration to access premium AI prompts</p>
          </div>

          <!-- Main content -->
          <table role="presentation" class="main" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background: #ffffff; border-radius: 0 0 8px 8px; width: 100%;" width="100%">
            <tr>
              <td class="wrapper" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; vertical-align: top; box-sizing: border-box; padding: 40px;" valign="top">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%">
                  <tr>
                    <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; vertical-align: top;" valign="top">
                      <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 20px; font-weight: 400;">Hi ${data.name},</h2>
                      
                      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: normal; margin: 0 0 15px; color: #666666; line-height: 1.6;">
                        Thank you for signing up for JoJo Prompts! To complete your registration and start exploring our collection of premium AI prompts, please confirm your email address by clicking the button below.
                      </p>

                      <!-- CTA Button -->
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; box-sizing: border-box; width: 100%; margin: 30px 0;" width="100%">
                        <tbody>
                          <tr>
                            <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; vertical-align: top; padding-bottom: 15px;" valign="top">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: auto;">
                                <tbody>
                                  <tr>
                                    <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; vertical-align: top; border-radius: 8px; text-align: center; background-color: #c49d68;" valign="top" align="center" bgcolor="#c49d68">
                                      <a href="${data.confirmationLink}" target="_blank" style="border: solid 1px #c49d68; border-radius: 8px; box-sizing: border-box; cursor: pointer; display: inline-block; font-size: 16px; font-weight: bold; margin: 0; padding: 15px 40px; text-decoration: none; text-transform: capitalize; background-color: #c49d68; border-color: #c49d68; color: #ffffff;">Confirm Email Address</a>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: normal; margin: 0 0 15px; color: #999999; line-height: 1.6;">
                        If the button above doesn't work, copy and paste the following link into your browser:
                      </p>
                      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; font-weight: normal; margin: 0 0 15px; color: #007bff; line-height: 1.6; word-break: break-all;">
                        ${data.confirmationLink}
                      </p>

                      <!-- Security notice -->
                      <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 20px; margin: 25px 0;">
                        <p style="margin: 0; color: #495057; font-size: 13px; line-height: 1.6;">
                          <strong>Security Notice:</strong> This confirmation link will expire in 24 hours. If you didn't create an account with JoJo Prompts, you can safely ignore this email.
                        </p>
                      </div>

                      <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: normal; margin: 30px 0 15px; color: #666666; line-height: 1.6;">
                        Questions? Reply to this email or contact our support team at info@jojoprompts.com
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Footer -->
          <div class="footer" style="clear: both; margin-top: 10px; text-align: center; width: 100%;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;" width="100%">
              <tr>
                <td class="content-block" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; vertical-align: top; padding-bottom: 10px; padding-top: 10px; color: #999999; font-size: 12px; text-align: center;" valign="top" align="center">
                  <span class="apple-link" style="color: #999999; font-size: 12px; text-align: center;">
                    JoJo Prompts, Part of Recipe Group<br>
                    Abdullah Al Mubarak St, Humaidhiyah Tower<br>
                    Murqab, Kuwait City 15001
                  </span>
                </td>
              </tr>
              <tr>
                <td class="content-block powered-by" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; vertical-align: top; padding-bottom: 10px; padding-top: 10px; color: #999999; font-size: 12px; text-align: center;" valign="top" align="center">
                  <a href="https://jojoprompts.com/unsubscribe?email=${data.email}&type=email_confirmation" style="color: #999999; font-size: 12px; text-align: center; text-decoration: none;">Unsubscribe</a> |
                  <a href="https://jojoprompts.com/privacy" style="color: #999999; font-size: 12px; text-align: center; text-decoration: none;">Privacy Policy</a>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </td>
      <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; vertical-align: top;" valign="top">&nbsp;</td>
    </tr>
  </table>
</body>
</html>`,
    text: `Confirm Your Email Address - JoJo Prompts

Hi ${data.name},

Thank you for signing up for JoJo Prompts! To complete your registration and start exploring our collection of premium AI prompts, please confirm your email address using the link below:

${data.confirmationLink}

This confirmation link will expire in 24 hours.

If you didn't create an account with JoJo Prompts, you can safely ignore this email.

Questions? Contact our support team at info@jojoprompts.com

Best regards,
The JoJo Prompts Team

---
JoJo Prompts, Part of Recipe Group
Abdullah Al Mubarak St, Humaidhiyah Tower
Murqab, Kuwait City 15001

Unsubscribe: https://jojoprompts.com/unsubscribe?email=${data.email}&type=email_confirmation
Privacy Policy: https://jojoprompts.com/privacy`
  })
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

interface EmailRequest {
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  user_id?: string;
  email_type?: string;
  template?: string;
  data?: any;
}

function getSubject(email_type: string): string {
  switch (email_type) {
    case 'email_confirmation':
      return 'Confirm Your Email Address - JoJo Prompts';
    default:
      return 'JoJo Prompts';
  }
}

function getEmailHtml(email_type: string, data: any): string {
  switch (email_type) {
    case 'email_confirmation':
      if (emailTemplates.emailConfirmation) {
        return emailTemplates.emailConfirmation(data).html;
      }
      break;
    default:
      return data.html || '<p>Thank you for using JoJo Prompts!</p>';
  }
  return '<p>Thank you for using JoJo Prompts!</p>';
}

// Simple logging function
async function logEmailAttempt(supabase: any, emailData: {
  email_address: string;
  email_type: string;
  success: boolean;
  error_message?: string;
  user_id?: string;
}) {
  try {
    const { error } = await supabase
      .from('email_logs')
      .insert([{
        email_address: emailData.email_address,
        email_type: emailData.email_type,
        success: emailData.success,
        error_message: emailData.error_message,
        user_id: emailData.user_id,
        domain_type: 'other',
        retry_count: 0,
        delivery_status: emailData.success ? 'sent' : 'failed'
      }]);
    
    if (error) {
      console.log('Error logging email attempt:', error);
    }
  } catch (error) {
    console.log('Error in logEmailAttempt:', error);
  }
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  console.log(`[send-email:${requestId}] Processing request`);

  // Initialize Supabase client for logging
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { 
      to: email_address, 
      subject, 
      html, 
      text, 
      user_id, 
      email_type = 'general',
      template,
      data 
    }: EmailRequest = await req.json();
    
    console.log(`[send-email:${requestId}] Sending ${email_type} email to ${email_address}`);
    
    // Handle template-based emails
    let finalSubject = subject || getSubject(email_type);
    let finalHtml = html || getEmailHtml(email_type, data);
    let finalText = text;

    if (template && data) {
      console.log(`[send-email:${requestId}] Processing template: ${template}`);
      
      if (emailTemplates[template as keyof typeof emailTemplates]) {
        const templateFn = emailTemplates[template as keyof typeof emailTemplates];
        const templateResult = templateFn(data);
        
        finalSubject = templateResult.subject;
        finalHtml = templateResult.html;
        finalText = templateResult.text || finalHtml.replace(/<[^>]*>/g, '');
      } else {
        console.log(`[send-email:${requestId}] Template not found: ${template}`);
      }
    }

    if (!email_address || !finalSubject || !finalHtml) {
      throw new Error('Missing required fields: email_address, subject, html');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email_address)) {
      throw new Error('Invalid email address format');
    }
    
    // Configure email with our verified subdomain
    const emailConfig = {
      from: 'JoJo Prompts <noreply@noreply.jojoprompts.com>',
      to: email_address,
      subject: finalSubject,
      html: finalHtml,
      text: finalText || finalHtml.replace(/<[^>]*>/g, ''),
      headers: {
        'Reply-To': 'info@jojoprompts.com',
        'List-Unsubscribe': '<mailto:unsubscribe@jojoprompts.com>',
        'X-Entity-Ref-ID': `jojoprompts-${Date.now()}`,
        'Message-ID': `<${crypto.randomUUID()}@noreply.jojoprompts.com>`,
        'Precedence': 'transactional',
        'Auto-Submitted': 'auto-generated',
        'Date': new Date().toUTCString(),
        'Content-Type': 'text/html; charset=UTF-8',
        'MIME-Version': '1.0'
      }
    };
    
    // Send via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);
    const result = await resend.emails.send(emailConfig);
    
    if (result.error) {
      throw new Error(`Resend API error: ${result.error.name} - ${result.error.message}`);
    }

    console.log(`[send-email:${requestId}] Email sent successfully:`, result);
    
    // Log successful attempt
    await logEmailAttempt(supabase, {
      email_address,
      email_type,
      success: true,
      user_id
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully', 
        messageId: result.data?.id || result.id 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error: any) {
    console.error(`[send-email:${requestId}] Email error:`, error);
    
    // Log failed attempt if we have email info
    const requestData = await req.json().catch(() => ({}));
    if (requestData.to) {
      await logEmailAttempt(supabase, {
        email_address: requestData.to,
        email_type: requestData.email_type || 'general',
        success: false,
        error_message: error.message,
        user_id: requestData.user_id
      });
    }
    
    // Still return 200 to prevent edge function errors
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Email processing failed', 
        error: error.message 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

serve(handler);
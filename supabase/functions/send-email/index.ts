import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { Resend } from 'npm:resend@2.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const emailTemplates = {
  emailConfirmation: (data: { name: string; email: string; confirmationLink: string; email_type?: string }) => {
    const emailType = data.email_type || 'confirmation';
    const unsubscribeUrl = `https://jojoprompts.com/unsubscribe?email=${encodeURIComponent(data.email)}&type=${emailType}`;
    
    return {
      subject: "Your JoJo Prompts account confirmation",
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>Email Confirmation - JoJo Prompts</title>
</head>
<body style="background-color: #ffffff; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.4; margin: 0; padding: 0;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0; padding: 0;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px; background-color: #ffffff;">
          
          <!-- Trust signal -->
          <tr>
            <td style="padding: 0 0 20px 0;">
              <p style="font-size: 12px; color: #666; margin: 0; font-family: Arial, sans-serif;">You're receiving this because you signed up at jojoprompts.com</p>
            </td>
          </tr>
          
          <!-- Header -->
          <tr>
            <td style="background: #f8f9fa; padding: 20px; border-radius: 4px; border: 1px solid #dee2e6;">
              <h1 style="margin: 0 0 10px 0; font-size: 20px; font-family: Arial, sans-serif; color: #333;">Email Confirmation Required</h1>
              <p style="margin: 0; font-size: 14px; color: #666; font-family: Arial, sans-serif;">Please confirm your email address to complete setup</p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding: 30px 0;">
              <h2 style="color: #333; margin: 0 0 15px 0; font-family: Arial, sans-serif; font-size: 18px;">Hi ${data.name},</h2>
              
              <p style="color: #666; line-height: 1.5; margin: 15px 0; font-family: Arial, sans-serif; font-size: 14px;">
                Please confirm your email address to complete your account setup. This is required to access your account.
              </p>

              <!-- CTA Button -->
              <p style="margin: 20px 0;">
                <a href="${data.confirmationLink}" style="background-color: #007bff; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-size: 14px; display: inline-block; font-family: Arial, sans-serif;">
                  Confirm Email Address
                </a>
              </p>

              <p style="color: #666; font-size: 12px; line-height: 1.4; margin: 15px 0; font-family: Arial, sans-serif;">
                This link will expire in 24 hours. If you didn't create an account with us, please ignore this email.
              </p>
              
              <p style="color: #666; font-size: 12px; line-height: 1.4; margin: 15px 0; font-family: Arial, sans-serif;">
                If the button doesn't work, copy this link: ${data.confirmationLink}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 0; border-top: 1px solid #dee2e6;">
              <p style="color: #666; margin: 0 0 10px 0; font-family: Arial, sans-serif; font-size: 12px;">
                Questions? Contact us at info@jojoprompts.com
              </p>
              
              <p style="margin: 10px 0; font-size: 12px; color: #666; font-family: Arial, sans-serif;">
                Don't want these emails? <a href="${unsubscribeUrl}" style="color: #666;">Unsubscribe here</a>
              </p>
              
              <p style="margin: 10px 0; font-size: 11px; color: #999; font-family: Arial, sans-serif;">
                To unsubscribe, copy and paste this link into your browser: ${unsubscribeUrl}
              </p>
              
              <p style="margin: 10px 0 0 0; font-size: 11px; color: #999; font-family: Arial, sans-serif;">
                JoJo Prompts, Part of Recipe Group<br>
                Abdullah Al Mubarak St, Humaidhiyah Tower<br>
                Murqab, Kuwait City 15001
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text: `You're receiving this because you signed up at jojoprompts.com

Hi ${data.name},

Please confirm your email address to complete your account setup:
${data.confirmationLink}

This link will expire in 24 hours.

If you didn't create an account with us, please ignore this email.

Questions? Contact us at info@jojoprompts.com

Don't want these emails? Unsubscribe here:
${unsubscribeUrl}

To unsubscribe, copy and paste this link into your browser: ${unsubscribeUrl}

JoJo Prompts, Part of Recipe Group
Abdullah Al Mubarak St, Humaidhiyah Tower
Murqab, Kuwait City 15001`
    };
  }
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
  template_slug?: string;
  variables?: any;
}

function getSubject(email_type: string): string {
  switch (email_type) {
    case 'email_confirmation':
      return 'Your JoJo Prompts account confirmation';
    default:
      return 'JoJo Prompts';
  }
}

function getEmailHtml(email_type: string, data: any): string {
  const baseHtml = (() => {
    switch (email_type) {
      case 'email_confirmation':
        if (emailTemplates.emailConfirmation) {
          return emailTemplates.emailConfirmation({ ...data, email_type }).html;
        }
        break;
      default:
        return data.html || '<p>Thank you for using JoJo Prompts!</p>';
    }
    return '<p>Thank you for using JoJo Prompts!</p>';
  })();

  // Add tracking pixel for email opens
  const trackingPixel = `<img src="https://fxkqgjakbyrxkmevkglv.supabase.co/functions/v1/track-email-engagement?email=${encodeURIComponent(data.email || '')}" width="1" height="1" style="display:none;" alt="" />`;
  
  return baseHtml + trackingPixel;
}

// Helper: deep-get value by path (e.g., user.first_name)
function getProp(obj: Record<string, any>, path: string) {
  return path.split('.').reduce((acc: any, key: string) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

// Helper: replace {{variable}} placeholders
function interpolate(input: string, vars: Record<string, any>) {
  if (!input) return input;
  return input.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) => {
    const val = getProp(vars, key);
    return val !== undefined && val !== null ? String(val) : '';
  });
}

function stripTags(html: string) {
  return html.replace(/<[^>]*>/g, '');
}

function buildTrackingPixel(email: string) {
  return `<img src="https://fxkqgjakbyrxkmevkglv.supabase.co/functions/v1/track-email-engagement?email=${encodeURIComponent(email || '')}" width="1" height="1" style="display:none;" alt="" />`;
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
      data,
      template_slug,
      variables
    }: EmailRequest = await req.json();
    
    // Merge variables and ensure defaults
    const vars = { ...(data || {}), ...(variables || {}) };
    if (email_address) {
      vars.email = email_address;
      vars.unsubscribe_link = vars.unsubscribe_link || `https://jojoprompts.com/unsubscribe?email=${encodeURIComponent(email_address)}&type=${email_type}`;
    }
    
    console.log(`[send-email:${requestId}] Sending ${email_type} email to ${email_address}`);
    
    // Check if user has unsubscribed
    const { data: unsubData } = await supabase
      .from('unsubscribed_emails')
      .select('email')
      .eq('email', email_address)
      .maybeSingle();
    
    if (unsubData) {
      console.log(`[send-email:${requestId}] User ${email_address} has unsubscribed - skipping email`);
      
      // Log the blocked email attempt
      await logEmailAttempt(supabase, {
        email_address,
        email_type,
        success: true,
        error_message: 'Email blocked - user unsubscribed',
        user_id
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User unsubscribed - email not sent',
          unsubscribed: true 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Handle template-based emails
    let finalSubject = subject || getSubject(email_type);
    let finalHtml = html || getEmailHtml(email_type, { ...vars, email: email_address });
    let finalText = text;

    // Load and render DB-managed template by slug if provided
    if (template_slug) {
      console.log(`[send-email:${requestId}] Loading template slug: ${template_slug}`);
      const { data: tmpl, error: tmplErr } = await supabase
        .from('email_templates')
        .select('subject, html, text, is_active')
        .eq('slug', template_slug)
        .eq('is_active', true)
        .maybeSingle();

      if (tmplErr) {
        console.log(`[send-email:${requestId}] DB template load error:`, tmplErr);
      }
      if (tmpl) {
        const htmlInterpolated = interpolate(tmpl.html, vars);
        finalSubject = interpolate(tmpl.subject, vars);
        finalHtml = htmlInterpolated + buildTrackingPixel(email_address);
        finalText = interpolate(tmpl.text || stripTags(htmlInterpolated), vars);
      } else {
        console.log(`[send-email:${requestId}] Template slug not found or inactive: ${template_slug}`);
      }
    }

    if (template && (data || variables)) {
      console.log(`[send-email:${requestId}] Processing legacy template: ${template}`);
      if (emailTemplates[template as keyof typeof emailTemplates]) {
        const templateFn = emailTemplates[template as keyof typeof emailTemplates];
        const templateResult = templateFn({ ...(vars || {}), email_type });
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
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID': `jojoprompts-${Date.now()}`,
        'Message-ID': `<${crypto.randomUUID()}@noreply.jojoprompts.com>`,
        'Precedence': 'transactional',
        'Auto-Submitted': 'auto-generated',
        'X-Priority': '3',
        'Importance': 'Normal',
        'X-Mailer': 'JoJo Prompts Mailer 1.0',
        'Feedback-ID': `jp:account:${email_type}:${user_id || 'anonymous'}`,
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
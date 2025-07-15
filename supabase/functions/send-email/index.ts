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
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
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
  subject?: string; // Optional if using template
  html?: string; // Optional if using template
  text?: string;
  user_id?: string;
  email_type?: string;
  retry_count?: number;
  priority?: 'high' | 'normal' | 'low';
  template?: string; // Template name
  data?: any; // Template data
}

// Apple email domains that require special handling
const APPLE_DOMAINS = ['icloud.com', 'mac.com', 'me.com'];

// Apple-specific configuration based on Apple's postmaster guidelines
const getAppleConfig = (emailType: string) => ({
  maxRetries: 3, // Reduced retries for transactional emails
  baseDelayMs: 5000, // Longer delays for Apple
  maxDelayMs: 60000, // Max 1 minute
  backoffMultiplier: 2,
  specialHeaders: emailType === 'email_confirmation' || emailType === 'transactional' ? {
    // Transactional email headers for signup confirmations
    'X-Priority': '1', // High priority for transactional
    'X-MSMail-Priority': 'High',
    'Importance': 'High',
    'X-Entity-Ref-ID': 'jojoprompts-transactional',
    'X-Auto-Response-Suppress': 'DR, RN, NRN, OOF', // Suppress auto-responses but not delivery receipts
    'Return-Path': 'noreply@noreply.jojoprompts.com',
    'Content-Type': 'text/html; charset=UTF-8',
    'MIME-Version': '1.0',
    'X-Mailer': 'JoJoPrompts-v1.0',
    'X-Apple-Mail-Remote-Attachments': 'NO',
    'Thread-Topic': 'Email Confirmation Required'
  } : {
    // Marketing/bulk email headers
    'List-Unsubscribe': '<mailto:unsubscribe@noreply.jojoprompts.com>, <https://jojoprompts.com/unsubscribe>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'X-Priority': '3',
    'X-MSMail-Priority': 'Normal',
    'Importance': 'Normal',
    'X-Entity-Ref-ID': 'jojoprompts-marketing',
    'Precedence': 'bulk',
    'X-Auto-Response-Suppress': 'All',
    'Return-Path': 'noreply@noreply.jojoprompts.com',
    'Content-Type': 'text/html; charset=UTF-8',
    'MIME-Version': '1.0'
  }
});

// Standard retry configuration for other domains
const STANDARD_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  backoffMultiplier: 2
};

// Function to detect domain type
function getDomainType(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return 'unknown';
  
  // Check for Apple domains (including me.com)
  if (APPLE_DOMAINS.includes(domain)) return 'apple';
  if (domain === 'gmail.com') return 'gmail';
  if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') return 'outlook';
  return 'other';
}

// Calculate exponential backoff delay
function calculateDelay(retryCount: number, domainType: string, emailType: string): number {
  const config = domainType === 'apple' ? getAppleConfig(emailType) : STANDARD_CONFIG;
  const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, retryCount);
  return Math.min(delay, config.maxDelayMs);
}

// Function to optimize email content for Apple domains
function optimizeForApple(html: string, subject: string): { html: string; subject: string } {
  // Apple Mail preferences
  let optimizedHtml = html;
  let optimizedSubject = subject;
  
  // Add Apple-specific optimizations
  // 1. Ensure proper HTML structure
  if (!optimizedHtml.includes('<!DOCTYPE html>')) {
    optimizedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${optimizedSubject}</title>
</head>
<body>
${optimizedHtml}
</body>
</html>`;
  }
  
  // 2. Apple Mail prefers specific CSS
  optimizedHtml = optimizedHtml.replace(
    /<style[^>]*>/gi,
    '<style type="text/css">'
  );
  
  // 3. Ensure proper encoding for special characters
  optimizedSubject = optimizedSubject.replace(/[^\x00-\x7F]/g, (char) => {
    return '&#' + char.charCodeAt(0) + ';';
  });
  
  return { html: optimizedHtml, subject: optimizedSubject };
}

// Function to log email attempt to database
async function logEmailAttempt(supabase: any, emailData: {
  email_address: string;
  email_type: string;
  success: boolean;
  error_message?: string;
  user_id?: string;
  domain_type: string;
  retry_count: number;
  delivery_status: string;
  response_metadata?: any;
  bounce_reason?: string;
}, logger: any) {
  try {
    // Create a clean email data object, excluding user_id if it's null/undefined
    // This prevents foreign key constraint violations when user_id doesn't exist in auth.users
    const cleanEmailData = {
      email_address: emailData.email_address,
      email_type: emailData.email_type,
      success: emailData.success,
      domain_type: emailData.domain_type,
      retry_count: emailData.retry_count,
      delivery_status: emailData.delivery_status,
      ...(emailData.error_message && { error_message: emailData.error_message }),
      ...(emailData.response_metadata && { response_metadata: emailData.response_metadata }),
      ...(emailData.bounce_reason && { bounce_reason: emailData.bounce_reason }),
      // Only include user_id if it exists and is not null/empty
      ...(emailData.user_id && emailData.user_id.trim() !== '' && { user_id: emailData.user_id })
    };

    logger('Logging email attempt:', { 
      email_address: cleanEmailData.email_address,
      success: cleanEmailData.success,
      user_id: cleanEmailData.user_id || 'none'
    });

    const { error } = await supabase
      .from('email_logs')
      .insert([cleanEmailData]);
    
    if (error) {
      logger('ERROR logging email attempt:', error);
      // Try logging without user_id if it still fails
      if (error.code === '23503' && emailData.user_id) {
        logger('Retrying email log without user_id due to foreign key constraint');
        const { user_id, ...dataWithoutUserId } = cleanEmailData;
        const { error: retryError } = await supabase
          .from('email_logs')
          .insert([dataWithoutUserId]);
        
        if (retryError) {
          logger('ERROR on retry logging email attempt:', retryError);
        } else {
          logger('Email attempt logged successfully on retry (without user_id)');
        }
      }
    } else {
      logger('Email attempt logged successfully');
    }
  } catch (error) {
    logger('ERROR in logEmailAttempt:', error);
  }
}

// Function to check if we should alert on delivery failures
async function checkAlertThresholds(supabase: any, domainType: string, logger: any) {
  try {
    // Check last hour's Apple domain success rate
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: recentLogs, error } = await supabase
      .from('email_logs')
      .select('success, domain_type')
      .eq('domain_type', domainType)
      .gte('attempted_at', oneHourAgo);
    
    if (error || !recentLogs || recentLogs.length < 5) {
      return; // Not enough data for alerting
    }
    
    const successfulCount = recentLogs.filter(log => log.success).length;
    const successRate = (successfulCount / recentLogs.length) * 100;
    
    // Alert thresholds
    const criticalThreshold = domainType === 'apple' ? 70 : 80; // Lower threshold for Apple
    const warningThreshold = domainType === 'apple' ? 85 : 90;
    
    if (successRate < criticalThreshold) {
      logger(`CRITICAL ALERT: ${domainType} domain success rate: ${successRate.toFixed(1)}% (${successfulCount}/${recentLogs.length})`);
      
      // Log security event for monitoring
      await supabase
        .from('security_logs')
        .insert([{
          action: 'email_delivery_critical_failure',
          details: {
            domain_type: domainType,
            success_rate: successRate,
            total_emails: recentLogs.length,
            successful_emails: successfulCount,
            time_window: '1_hour',
            alert_level: 'critical'
          }
        }]);
    } else if (successRate < warningThreshold) {
      logger(`WARNING: ${domainType} domain success rate: ${successRate.toFixed(1)}% (${successfulCount}/${recentLogs.length})`);
      
      await supabase
        .from('security_logs')
        .insert([{
          action: 'email_delivery_warning',
          details: {
            domain_type: domainType,
            success_rate: successRate,
            total_emails: recentLogs.length,
            successful_emails: successfulCount,
            time_window: '1_hour',
            alert_level: 'warning'
          }
        }]);
    }
  } catch (error) {
    logger('ERROR checking alert thresholds:', error);
  }
}

// Main send email function with retry logic
async function sendEmailWithRetry(
  resend: any,
  emailPayload: any,
  domainType: string,
  retryCount: number,
  emailType: string,
  logger: any
): Promise<any> {
  const config = domainType === 'apple' ? getAppleConfig(emailType) : STANDARD_CONFIG;
  
  try {
    // Apply Apple-specific optimizations
    if (domainType === 'apple') {
      const optimized = optimizeForApple(emailPayload.html, emailPayload.subject);
      emailPayload.html = optimized.html;
      emailPayload.subject = optimized.subject;
      
      // Add Apple-specific headers (merge with existing headers)
      const appleConfig = getAppleConfig(emailType);
      emailPayload.headers = {
        ...emailPayload.headers,
        ...appleConfig.specialHeaders,
        'X-Apple-Base-URL': 'https://jojoprompts.com',
        'Thread-Topic': emailPayload.subject
      };
      
      logger('Applied Apple-specific optimizations:', {
        hasOptimizedHtml: !!optimized.html,
        hasOptimizedSubject: !!optimized.subject,
        headers: emailPayload.headers
      });
    }
    
    console.log('Sending email with final payload:', {
      from: emailPayload.from,
      to: emailPayload.to,
      subject: emailPayload.subject,
      hasHtml: !!emailPayload.html,
      hasText: !!emailPayload.text,
      headerKeys: Object.keys(emailPayload.headers || {}),
      retryCount,
      domainType
    });

    let response;
    try {
      response = await resend.emails.send(emailPayload);
      console.log('Resend API response:', {
        success: !response.error,
        data: response.data,
        error: response.error,
        statusCode: response.error?.name || 'success'
      });
    } catch (apiError: any) {
      console.error('Resend API call failed with exception:', {
        name: apiError.name,
        message: apiError.message,
        cause: apiError.cause,
        stack: apiError.stack,
        domainType,
        emailType,
        retryCount,
        from: emailPayload.from
      });
      throw new Error(`Resend API exception: ${apiError.message} (${apiError.name})`);
    }
    
    if (response.error) {
      console.error(`Email send attempt ${retryCount + 1} failed:`, {
        error: response.error,
        errorName: response.error.name,
        errorMessage: response.error.message,
        domainType,
        emailType,
        retryCount,
        from: emailPayload.from,
        fullError: JSON.stringify(response.error)
      });
      throw new Error(`Resend API error: ${response.error.name} - ${response.error.message}`);
    }
    
    return response;
  } catch (error: any) {
    logger(`Attempt ${retryCount + 1} failed:`, error.message);
    
    // Check if we should retry
    if (retryCount < config.maxRetries) {
      const delay = calculateDelay(retryCount, domainType, emailType);
      logger(`Retrying in ${delay}ms (domain: ${domainType}, attempt: ${retryCount + 1}/${config.maxRetries})`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return sendEmailWithRetry(resend, emailPayload, domainType, retryCount + 1, emailType, logger);
    }
    
    // Max retries reached
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const logger = (...args: any[]) => console.log(`[send-email:${requestId}]`, ...args);

  // Initialize Supabase client for logging
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let domainType = 'unknown';
  let emailAddress = '';
  let emailType = 'unknown';
  let userId: string | undefined;
  let finalRetryCount = 0;

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      logger('ERROR: RESEND_API_KEY not configured');
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);
    const requestBody = await req.json();
    
    const { 
      to, 
      subject, 
      html, 
      text, 
      user_id, 
      email_type: reqEmailType,
      retry_count = 0,
      priority = 'normal',
      template,
      data
    }: EmailRequest = requestBody;
    
    // Store values for logging
    emailAddress = to;
    emailType = reqEmailType || 'general';
    userId = user_id;
    domainType = getDomainType(to);
    finalRetryCount = retry_count;
    
    logger('Received request:', { 
      to, 
      subject, 
      template,
      domainType,
      emailType,
      userId,
      retryCount: finalRetryCount,
      priority
    });

    // Log domain detection for debugging
    logger(`Domain detection for ${to}: domain=${to.split('@')[1]}, detected_type=${domainType}`);

    // Handle template-based emails
    let finalSubject = subject;
    let finalHtml = html;
    let finalText = text;

    if (template && data) {
      logger('Processing template:', template);
      
      if (emailTemplates[template as keyof typeof emailTemplates]) {
        const templateFn = emailTemplates[template as keyof typeof emailTemplates];
        const templateResult = templateFn(data);
        
        finalSubject = templateResult.subject;
        finalHtml = templateResult.html;
        finalText = templateResult.text || finalHtml.replace(/<[^>]*>/g, '');
        
        logger('Template processed successfully:', { template, hasHtml: !!finalHtml, hasSubject: !!finalSubject });
      } else {
        logger('ERROR: Template not found:', template);
        throw new Error(`Template not found: ${template}`);
      }
    }

    if (!to || !finalSubject || !finalHtml) {
      logger('ERROR: Missing required fields:', { to: !!to, subject: !!finalSubject, html: !!finalHtml });
      throw new Error('Missing required fields: to, subject, html (or valid template)');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      logger('ERROR: Invalid email address format:', to);
      throw new Error('Invalid email address format');
    }

    // Apple domain detection and logging
    if (domainType === 'apple') {
      logger('APPLE DOMAIN DETECTED: Applying enhanced delivery strategy for:', to);
    }

    // Generate unique Message-ID for better deliverability
    const messageId = `<${requestId}.${Date.now()}@jojoprompts.com>`;
    
    const emailPayload = {
      from: 'JoJo Prompts <noreply@noreply.jojoprompts.com>',
      to: [to],
      subject: finalSubject,
      html: finalHtml,
      text: finalText || finalHtml.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
      reply_to: 'info@jojoprompts.com',
      headers: {
        'Message-ID': messageId,
        'List-Unsubscribe': '<mailto:unsubscribe@noreply.jojoprompts.com>, <https://jojoprompts.com/unsubscribe>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID': `jojoprompts-${emailType}-${requestId}`,
        // Remove Precedence: bulk for transactional emails like signup confirmations
        ...(emailType === 'email_confirmation' || emailType === 'transactional' ? {} : { 'Precedence': 'bulk' }),
        'X-Auto-Response-Suppress': emailType === 'email_confirmation' ? 'OOF, AutoReply' : 'All',
        'Organization': 'Recipe Group',
        'X-Mailer': 'JoJoPrompts Email Service v1.0',
        'X-Feedback-ID': `${emailType}:noreply.jojoprompts.com`,
        'Content-Type': 'text/html; charset=UTF-8',
        'MIME-Version': '1.0',
        // Add Apple-friendly headers for all emails
        'X-Apple-Mail-Remote-Attachments': 'NO',
        'Return-Path': 'noreply@noreply.jojoprompts.com'
      }
    };

    logger(`Sending email to ${to} (Domain: ${domainType}, Priority: ${priority})`);

    // Send email with domain-specific retry logic
    const emailResponse = await sendEmailWithRetry(
      resend,
      emailPayload,
      domainType,
      0, // Start with retry count 0
      email_type || 'transactional',
      logger
    );

    const responseMessageId = emailResponse.data?.id || emailResponse.id;
    const actualRetryCount = emailResponse.retryCount || 0;
    logger('Email sent successfully:', {
      messageId: responseMessageId,
      to,
      domainType,
      retryCount: actualRetryCount
    });

    // Log successful attempt
    await logEmailAttempt(supabase, {
      email_address: emailAddress,
      email_type: emailType,
      success: true,
      user_id: userId,
      domain_type: domainType,
      retry_count: actualRetryCount,
      delivery_status: 'sent',
      response_metadata: { messageId: responseMessageId, priority }
    }, logger);

    // Check alert thresholds in background
    EdgeRuntime.waitUntil(checkAlertThresholds(supabase, domainType, logger));

    return new Response(JSON.stringify({
      success: true,
      message: 'Email sent successfully',
      messageId: responseMessageId,
      domainType: domainType,
      retryCount: actualRetryCount,
      optimized: domainType === 'apple'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    logger('ERROR in send-email function:', error.message);
    
    // Determine bounce reason based on error
    let bounceReason = null;
    if (error.message.includes('blocked')) bounceReason = 'blocked';
    else if (error.message.includes('invalid')) bounceReason = 'invalid_address';
    else if (error.message.includes('quota')) bounceReason = 'quota_exceeded';
    else if (error.message.includes('timeout')) bounceReason = 'timeout';
    
    // Log failed attempt if we have the email info
    if (emailAddress) {
      await logEmailAttempt(supabase, {
        email_address: emailAddress,
        email_type: emailType,
        success: false,
        error_message: error.message,
        user_id: userId,
        domain_type: domainType,
        retry_count: 0,
        delivery_status: 'failed',
        bounce_reason: bounceReason
      }, logger);
    }
    
    // Check alert thresholds for failures too
    EdgeRuntime.waitUntil(checkAlertThresholds(supabase, domainType, logger));
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      domainType: domainType,
      retryCount: finalRetryCount,
      bounceReason: bounceReason
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
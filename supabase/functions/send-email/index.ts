import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { Resend } from 'npm:resend@2.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// Email templates
const emailTemplates = {
  emailConfirmation: (data: { name: string; email: string; confirmationLink: string }) => ({
    subject: "Confirm Your Email - JojoPrompts",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #c49d68 0%, #b8935a 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
          <img src="https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/object/public/storage.bucket/jojo-prompts-logo.png" alt="JoJo Prompts" style="max-height: 60px; margin-bottom: 15px;" />
          <h1 style="margin: 0; font-size: 28px;">Confirm Your Email</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Complete your registration</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 20px;">Hi ${data.name}! 👋</h2>
          
          <p style="color: #666; line-height: 1.6; margin: 20px 0;">
            Please confirm your email address to complete your registration and start exploring amazing AI prompts.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.confirmationLink}" style="background: #c49d68; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
              Confirm Email Address
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 30px 0;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <span style="word-break: break-all; color: #007bff;">${data.confirmationLink}</span>
          </p>
          
          <div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 6px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #0c5460; font-size: 14px;">
              <strong>Security tip:</strong> This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin: 20px 0; padding: 20px; color: #666; font-size: 14px;">
          <p style="margin: 0;">Welcome to JoJo Prompts!<br><strong>The JoJo Prompts Team</strong></p>
        </div>
        
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
    text: `Hi ${data.name},\n\nPlease confirm your email address to complete your registration:\n\n${data.confirmationLink}\n\nThis link will expire in 24 hours.\n\nWelcome to JoJo Prompts!\nThe JoJo Prompts Team`
  })
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// Apple-specific configuration
const APPLE_CONFIG = {
  maxRetries: 5,
  baseDelayMs: 2000, // Start with 2 seconds
  maxDelayMs: 30000, // Max 30 seconds
  backoffMultiplier: 2.5,
  specialHeaders: {
    'List-Unsubscribe': '<mailto:unsubscribe@jojoprompts.com>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
  }
};

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
function calculateDelay(retryCount: number, domainType: string): number {
  const config = domainType === 'apple' ? APPLE_CONFIG : STANDARD_CONFIG;
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
    const { error } = await supabase
      .from('email_logs')
      .insert([emailData]);
    
    if (error) {
      logger('ERROR logging email attempt:', error);
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
  logger: any
): Promise<any> {
  const config = domainType === 'apple' ? APPLE_CONFIG : STANDARD_CONFIG;
  
  try {
    // Apply Apple-specific optimizations
    if (domainType === 'apple') {
      const optimized = optimizeForApple(emailPayload.html, emailPayload.subject);
      emailPayload.html = optimized.html;
      emailPayload.subject = optimized.subject;
      
      // Add Apple-specific headers
      emailPayload.headers = {
        ...emailPayload.headers,
        ...APPLE_CONFIG.specialHeaders
      };
      
      logger('Applied Apple-specific optimizations:', {
        hasOptimizedHtml: !!optimized.html,
        hasOptimizedSubject: !!optimized.subject,
        headers: emailPayload.headers
      });
    }
    
    const response = await resend.emails.send(emailPayload);
    
    if (response.error) {
      throw new Error(response.error.message || 'Resend API error');
    }
    
    return response;
  } catch (error: any) {
    logger(`Attempt ${retryCount + 1} failed:`, error.message);
    
    // Check if we should retry
    if (retryCount < config.maxRetries) {
      const delay = calculateDelay(retryCount, domainType);
      logger(`Retrying in ${delay}ms (domain: ${domainType}, attempt: ${retryCount + 1}/${config.maxRetries})`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return sendEmailWithRetry(resend, emailPayload, domainType, retryCount + 1, logger);
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

    const emailPayload = {
      from: 'info@jojoprompts.com',
      to: [to],
      subject: finalSubject,
      html: finalHtml,
      text: finalText || finalHtml.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
    };

    logger(`Sending email to ${to} (Domain: ${domainType}, Priority: ${priority})`);

    // Send email with domain-specific retry logic
    const emailResponse = await sendEmailWithRetry(
      resend,
      emailPayload,
      domainType,
      0, // Start with retry count 0
      logger
    );

    const messageId = emailResponse.data?.id || emailResponse.id;
    logger('Email sent successfully:', {
      messageId,
      to,
      domainType,
      finalRetryCount
    });

    // Log successful attempt
    await logEmailAttempt(supabase, {
      email_address: emailAddress,
      email_type: emailType,
      success: true,
      user_id: userId,
      domain_type: domainType,
      retry_count: finalRetryCount,
      delivery_status: 'sent',
      response_metadata: { messageId, priority }
    }, logger);

    // Check alert thresholds in background
    EdgeRuntime.waitUntil(checkAlertThresholds(supabase, domainType, logger));

    return new Response(JSON.stringify({
      success: true,
      message: 'Email sent successfully',
      messageId: messageId,
      domainType: domainType,
      retryCount: finalRetryCount,
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
        retry_count: finalRetryCount,
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
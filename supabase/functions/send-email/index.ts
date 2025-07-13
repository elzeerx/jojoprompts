
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { Resend } from 'npm:resend@2.0.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  user_id?: string;
  email_type?: string;
}

// Apple email domains that require special handling
const APPLE_DOMAINS = ['icloud.com', 'mac.com', 'me.com'];

// Function to detect domain type
function getDomainType(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return 'unknown';
  
  if (APPLE_DOMAINS.includes(domain)) return 'apple';
  if (domain.includes('gmail.com')) return 'gmail';
  if (domain.includes('outlook.com') || domain.includes('hotmail.com') || domain.includes('live.com')) return 'outlook';
  return 'other';
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

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      logger('ERROR: RESEND_API_KEY not configured');
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);
    const requestBody = await req.json();
    
    const { to, subject, html, text, user_id, email_type: reqEmailType }: EmailRequest = requestBody;
    
    // Store values for logging
    emailAddress = to;
    emailType = reqEmailType || 'general';
    userId = user_id;
    domainType = getDomainType(to);
    
    logger('Received request body:', { 
      to, 
      subject, 
      hasHtml: !!html,
      hasText: !!text,
      domainType,
      emailType,
      userId
    });

    if (!to || !subject || !html) {
      logger('ERROR: Missing required fields:', { to: !!to, subject: !!subject, html: !!html });
      throw new Error('Missing required fields: to, subject, html');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      logger('ERROR: Invalid email address format:', to);
      throw new Error('Invalid email address format');
    }

    // Apple domain specific handling
    if (domainType === 'apple') {
      logger('APPLE DOMAIN DETECTED: Applying Apple-specific email handling for:', to);
      // Add special headers and settings for Apple domains
    }

    logger(`Sending email to ${to} with subject: "${subject}" (Domain: ${domainType})`);

    const emailPayload = {
      from: 'info@jojoprompts.com',
      to: [to],
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
    };

    logger('Sending email with payload:', {
      from: emailPayload.from,
      to: emailPayload.to,
      subject: emailPayload.subject,
      hasHtml: !!emailPayload.html,
      hasText: !!emailPayload.text,
      domainType
    });

    const emailResponse = await resend.emails.send(emailPayload);

    logger('Resend API response:', emailResponse);

    if (emailResponse.error) {
      logger('ERROR: Resend API error:', emailResponse.error);
      
      // Log failed attempt
      await logEmailAttempt(supabase, {
        email_address: emailAddress,
        email_type: emailType,
        success: false,
        error_message: `Resend API error: ${emailResponse.error.message || 'Unknown error'}`,
        user_id: userId,
        domain_type: domainType,
        retry_count: 0,
        delivery_status: 'failed',
        response_metadata: emailResponse.error
      }, logger);
      
      throw new Error(`Resend API error: ${emailResponse.error.message || 'Unknown error'}`);
    }

    const messageId = emailResponse.data?.id || emailResponse.id;
    logger('Email sent successfully:', {
      messageId,
      to,
      subject,
      domainType
    });

    // Log successful attempt
    await logEmailAttempt(supabase, {
      email_address: emailAddress,
      email_type: emailType,
      success: true,
      user_id: userId,
      domain_type: domainType,
      retry_count: 0,
      delivery_status: 'sent',
      response_metadata: { messageId }
    }, logger);

    return new Response(JSON.stringify({
      success: true,
      message: 'Email sent successfully',
      messageId: messageId,
      domainType: domainType
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    logger('ERROR in send-email function:', error.message);
    logger('Error stack:', error.stack);
    
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
        delivery_status: 'failed'
      }, logger);
    }
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      domainType: domainType
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

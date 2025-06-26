
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { Resend } from 'npm:resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const logger = (...args: any[]) => console.log(`[send-email:${requestId}]`, ...args);

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      logger('ERROR: RESEND_API_KEY not configured');
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);
    const requestBody = await req.json();
    logger('Received request body:', { 
      to: requestBody.to, 
      subject: requestBody.subject, 
      hasHtml: !!requestBody.html,
      hasText: !!requestBody.text 
    });

    const { to, subject, html, text }: EmailRequest = requestBody;

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

    logger(`Sending email to ${to} with subject: "${subject}"`);

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
      hasText: !!emailPayload.text
    });

    const emailResponse = await resend.emails.send(emailPayload);

    logger('Resend API response:', emailResponse);

    if (emailResponse.error) {
      logger('ERROR: Resend API error:', emailResponse.error);
      throw new Error(`Resend API error: ${emailResponse.error.message || 'Unknown error'}`);
    }

    const messageId = emailResponse.data?.id || emailResponse.id;
    logger('Email sent successfully:', {
      messageId,
      to,
      subject
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Email sent successfully',
      messageId: messageId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    logger('ERROR in send-email function:', error.message);
    logger('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

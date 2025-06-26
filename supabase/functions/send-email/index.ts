
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
    const { to, subject, html, text }: EmailRequest = await req.json();

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

    const emailResponse = await resend.emails.send({
      from: 'info@jojoprompts.com',
      to: [to],
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
    });

    if (emailResponse.error) {
      logger('ERROR: Resend API error:', emailResponse.error);
      throw new Error(`Resend API error: ${emailResponse.error.message || 'Unknown error'}`);
    }

    logger('Email sent successfully:', {
      messageId: emailResponse.data?.id || emailResponse.id,
      to,
      subject
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Email sent successfully',
      messageId: emailResponse.data?.id || emailResponse.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    logger('ERROR in send-email function:', error.message);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('send-email-confirmation-reminder');
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailConfirmationRequest {
  email: string;
  firstName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName }: EmailConfirmationRequest = await req.json();

    const emailResponse = await resend.emails.send({
      from: "JojoPrompts <noreply@jojoprompts.com>",
      to: [email],
      subject: "Secure your JojoPrompts account",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #c49d68; text-align: center;">Secure Your Account</h1>
          
          <p>Hi ${firstName},</p>
          
          <p>Thank you for joining JojoPrompts! To enhance your account security, please verify your email address when convenient.</p>
          
          <div style="background-color: #e8f4f8; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7a9e9f;">
            <p><strong>Note:</strong> Email verification is optional but recommended for account security and password recovery.</p>
          </div>
          
          <p>You can verify your email by:</p>
          <ol>
            <li>Logging into your JojoPrompts account</li>
            <li>Going to Account Settings</li>
            <li>Clicking "Verify Email Address"</li>
          </ol>
          
          <p>Enjoy exploring our premium AI prompts!</p>
          
          <p>Best regards,<br>The JojoPrompts Team</p>
        </div>
      `,
    });

    logger.info('Email confirmation reminder sent', { email, emailResponse });
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logger.error('Error sending email confirmation reminder', { error: error.message, email: req.url });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
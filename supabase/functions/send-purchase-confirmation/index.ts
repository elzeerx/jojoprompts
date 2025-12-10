import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('send-purchase-confirmation');
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PurchaseConfirmationRequest {
  email: string;
  firstName: string;
  planName: string;
  paymentId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, firstName, planName, paymentId }: PurchaseConfirmationRequest = await req.json();

    const emailResponse = await resend.emails.send({
      from: "JojoPrompts <noreply@jojoprompts.com>",
      to: [email],
      subject: `Thank you for your ${planName} purchase! 🎉`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #c49d68; text-align: center;">Welcome to JojoPrompts Premium!</h1>
          
          <p>Hi ${firstName},</p>
          
          <p>Thank you for purchasing the <strong>${planName}</strong> plan! Your payment has been processed successfully.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Payment ID:</strong> ${paymentId}</p>
            <p><strong>Plan:</strong> ${planName}</p>
          </div>
          
          <p>You now have access to premium features including:</p>
          <ul>
            <li>Unlimited prompt downloads</li>
            <li>Advanced search and filtering</li>
            <li>Priority customer support</li>
            <li>Exclusive premium prompts</li>
          </ul>
          
          <p>Start exploring your premium benefits at <a href="https://jojoprompts.com/prompts" style="color: #c49d68;">JojoPrompts.com</a></p>
          
          <p>If you have any questions, feel free to reach out to our support team.</p>
          
          <p>Best regards,<br>The JojoPrompts Team</p>
        </div>
      `,
    });

    logger.info('Purchase confirmation email sent', { email, planName, paymentId, emailResponse });
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    logger.error('Error sending purchase confirmation', { error: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
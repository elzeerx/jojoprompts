import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Validate environment variables
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
if (!RESEND_API_KEY) {
  console.error("[SEND-PLAN-REMINDER] RESEND_API_KEY environment variable is not set");
  throw new Error("RESEND_API_KEY is required");
}

const resend = new Resend(RESEND_API_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-PLAN-REMINDER] ${step}${detailsStr}`);
};

// Helper function to construct URLs safely
const getSiteUrl = () => {
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com";
  // Remove trailing slash to prevent double slashes
  return frontendUrl.replace(/\/+$/, '');
};

// Rate limiting utility
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry mechanism for email sending
const sendEmailWithRetry = async (emailData: any, maxRetries = 3): Promise<any> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logStep(`Email send attempt ${attempt}`, { to: emailData.to });
      
      const response = await resend.emails.send(emailData);
      
      if (response.error) {
        logStep(`Resend API error on attempt ${attempt}`, { 
          error: response.error,
          errorType: typeof response.error,
          statusCode: (response as any).statusCode,
          headers: (response as any).headers
        });
        throw new Error(`Resend API error: ${JSON.stringify(response.error)}`);
      }
      
      logStep(`Email sent successfully on attempt ${attempt}`, { 
        emailId: response.data?.id,
        to: emailData.to 
      });
      return response;
      
    } catch (error: any) {
      lastError = error;
      logStep(`Email send failed on attempt ${attempt}`, { 
        error: error.message,
        errorStack: error.stack,
        to: emailData.to
      });
      
      // Check if it's a rate limit error
      if (error.message?.includes('rate') || error.message?.includes('limit') || 
          error.message?.includes('429') || error.statusCode === 429) {
        const backoffDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
        logStep(`Rate limit detected, waiting ${backoffDelay}ms before retry`);
        await delay(backoffDelay);
      } else if (attempt < maxRetries) {
        // For other errors, wait a shorter time
        await delay(1000 * attempt);
      }
    }
  }
  
  throw lastError;
};

interface PlanReminderRequest {
  email: string;
  firstName: string;
  lastName: string;
  isIndividual?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Create Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin") {
      throw new Error("Insufficient permissions");
    }

    const { email, firstName, lastName, isIndividual = true }: PlanReminderRequest = await req.json();

    logStep("Sending plan reminder email", { email, firstName, isIndividual });

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }

    const emailData = {
      from: "JojoPrompts <noreply@noreply.jojoprompts.com>",
      to: [email],
      subject: "Unlock Premium Features - Choose Your Plan 🎯",
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="background: linear-gradient(135deg, #c49d68, #7a9e9f); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">JojoPrompts</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Premium AI Prompts Await You</p>
          </div>
          
          <div style="padding: 30px; background: #fff;">
            <h2 style="color: #c49d68; margin-bottom: 20px;">Hi ${firstName || 'there'},</h2>
            
            <p>We noticed you haven't selected a subscription plan yet. You're missing out on our premium AI prompts that can transform your creative workflow!</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #c49d68; margin-top: 0;">What You Get with Premium:</h3>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Access to thousands of high-quality AI prompts</li>
                <li>Exclusive prompt collections for different AI models</li>
                <li>Regular updates with new prompt categories</li>
                <li>Priority support and feature requests</li>
                <li>Commercial usage rights</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${getSiteUrl()}/pricing" 
                 style="display: inline-block; padding: 15px 30px; background: #c49d68; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Choose Your Plan Now
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Don't want to receive these emails? 
              <a href="${getSiteUrl()}/unsubscribe" style="color: #c49d68;">Unsubscribe here</a>
            </p>
          </div>
        </div>
      `,
    };

    const emailResponse = await sendEmailWithRetry(emailData);
    logStep("Email sent successfully", { emailId: emailResponse.data?.id });

    // Log the email activity
    await supabaseClient.from("email_logs").insert({
      email_address: email,
      email_type: "plan_reminder",
      success: true,
      user_id: null, // We don't have the target user's ID in this context
      attempted_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Plan reminder email sent successfully",
        emailId: emailResponse.data?.id 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    const errorMessage = error.message || String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
};

serve(handler);
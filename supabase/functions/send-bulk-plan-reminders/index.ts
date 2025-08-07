import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import React from 'npm:react@18.3.1';
import { renderAsync } from 'npm:@react-email/components@0.0.22';
import { PlanReminderEmail } from './_templates/plan-reminder.tsx';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Validate environment variables
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
if (!RESEND_API_KEY) {
  console.error("[SEND-BULK-PLAN-REMINDERS] RESEND_API_KEY environment variable is not set");
  throw new Error("RESEND_API_KEY is required");
}

const resend = new Resend(RESEND_API_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-BULK-PLAN-REMINDERS] ${step}${detailsStr}`);
};

// Helper function to construct URLs safely
const getSiteUrl = () => {
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com";
  // Remove trailing slash to prevent double slashes
  return frontendUrl.replace(/\/+$/, '');
};

// Rate limiting utility
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced email sending with retry mechanism
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

interface BulkReminderRequest {
  users: Array<{
    email: string;
    first_name: string;
    last_name: string;
  }>;
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

    const { users }: BulkReminderRequest = await req.json();

    if (!users || users.length === 0) {
      throw new Error("No users provided for bulk email");
    }

    logStep("Starting bulk email send", { userCount: users.length });

    const results = [];
    const batchSize = 5; // Reduced batch size for better rate limiting
    
    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      logStep(`Processing batch ${Math.floor(i / batchSize) + 1}`, { 
        batchStart: i + 1, 
        batchEnd: Math.min(i + batchSize, users.length),
        total: users.length 
      });
      
      const batchPromises = batch.map(async (targetUser) => {
        try {
          // Get user insights for personalization
          const { data: insightsData, error: insightsError } = await supabaseClient.functions.invoke('get-user-insights', {
            headers: { Authorization: req.headers.get("Authorization") || "" },
            body: { email: targetUser.email }
          });

          let userInsights = {
            personalizedMessage: `You haven't selected a subscription plan yet. You're missing out on our premium AI prompts that can transform your creative workflow!`,
            recommendedPlan: 'Starter',
            daysSinceSignup: 0,
            urgencyLevel: 'medium' as const,
            recommendationReason: 'Start with our Starter plan to explore thousands of quality AI prompts.'
          };

          if (insightsData?.success) {
            userInsights = insightsData.insights;
          }

          // Generate magic link for this user
          const { data: magicLinkData, error: magicLinkError } = await supabaseClient.functions.invoke('generate-magic-link', {
            headers: { Authorization: req.headers.get("Authorization") || "" },
            body: { 
              email: targetUser.email, 
              redirectTo: '/pricing',
              expirationHours: 48 
            }
          });

          let pricingLink = `${getSiteUrl()}/pricing`;
          if (magicLinkData?.success) {
            pricingLink = magicLinkData.magicLink;
          }

          // Generate smart unsubscribe link
          const { data: unsubscribeData, error: unsubscribeError } = await supabaseClient.functions.invoke('smart-unsubscribe', {
            headers: { Authorization: req.headers.get("Authorization") || "" },
            body: { email: targetUser.email }
          });

          let unsubscribeLink = `${getSiteUrl()}/unsubscribe`;
          if (unsubscribeData?.success) {
            unsubscribeLink = unsubscribeData.unsubscribeLink;
          }

          // Validate email address
          if (!emailRegex.test(targetUser.email)) {
            throw new Error(`Invalid email address: ${targetUser.email}`);
          }

          // Render React Email template
          const html = await renderAsync(
            React.createElement(PlanReminderEmail, {
              firstName: targetUser.first_name || 'there',
              personalizedMessage: userInsights.personalizedMessage,
              recommendedPlan: userInsights.recommendedPlan,
              recommendationReason: userInsights.recommendationReason,
              daysSinceSignup: userInsights.daysSinceSignup,
              urgencyLevel: userInsights.urgencyLevel,
              pricingLink,
              unsubscribeLink,
            })
          );

          const emailData = {
            from: "JojoPrompts <noreply@noreply.jojoprompts.com>",
            to: [targetUser.email],
            subject: "Unlock Premium Features - Choose Your Plan 🎯",
            html,
          };

          const emailResponse = await sendEmailWithRetry(emailData);

          // Log successful email
          await supabaseClient.from("email_logs").insert({
            email_address: targetUser.email,
            email_type: "bulk_plan_reminder",
            success: true,
            user_id: null,
            attempted_at: new Date().toISOString(),
          });

          return {
            email: targetUser.email,
            success: true,
            emailId: emailResponse.data?.id
          };
        } catch (error: any) {
          // Log failed email
          await supabaseClient.from("email_logs").insert({
            email_address: targetUser.email,
            email_type: "bulk_plan_reminder",
            success: false,
            error_message: error.message,
            user_id: null,
            attempted_at: new Date().toISOString(),
          });

          return {
            email: targetUser.email,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add a longer delay between batches to avoid rate limiting
      if (i + batchSize < users.length) {
        logStep(`Waiting 3 seconds before next batch to respect rate limits`);
        await delay(3000); // Increased to 3 seconds
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    logStep("Bulk email send completed", { 
      total: users.length, 
      success: successCount, 
      failures: failureCount 
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Bulk emails completed: ${successCount} sent, ${failureCount} failed`,
        results,
        summary: {
          total: users.length,
          sent: successCount,
          failed: failureCount
        }
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
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-BULK-PLAN-REMINDERS] ${step}${detailsStr}`);
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
    const batchSize = 10; // Process in batches to avoid rate limiting
    
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (targetUser) => {
        try {
          const emailResponse = await resend.emails.send({
            from: "JojoPrompts <noreply@jojoprompts.com>",
            to: [targetUser.email],
            subject: "Unlock Premium Features - Choose Your Plan 🎯",
            html: `
              <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="background: linear-gradient(135deg, #c49d68, #7a9e9f); padding: 30px; text-align: center; color: white;">
                  <h1 style="margin: 0; font-size: 28px;">JojoPrompts</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Premium AI Prompts Await You</p>
                </div>
                
                <div style="padding: 30px; background: #fff;">
                  <h2 style="color: #c49d68; margin-bottom: 20px;">Hi ${targetUser.first_name},</h2>
                  
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
                    <a href="${Deno.env.get("FRONTEND_URL")}/pricing" 
                       style="display: inline-block; padding: 15px 30px; background: #c49d68; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Choose Your Plan Now
                    </a>
                  </div>
                  
                  <p style="font-size: 14px; color: #666; margin-top: 30px;">
                    Don't want to receive these emails? 
                    <a href="${Deno.env.get("FRONTEND_URL")}/unsubscribe" style="color: #c49d68;">Unsubscribe here</a>
                  </p>
                </div>
              </div>
            `,
          });

          if (emailResponse.error) {
            throw new Error(`Email sending failed: ${emailResponse.error.message}`);
          }

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

      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
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
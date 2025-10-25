import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createEdgeLogger } from "../_shared/logger.ts";

const logger = createEdgeLogger('DEBUG_ENVIRONMENT');

logger.info('Debug-environment function initialized');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

serve(async (req: Request) => {
  logger.info('Debug environment request', { method: req.method });
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check all environment variables
    const envVars = {
      // Supabase variables
      SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "[SET]" : "[NOT SET]",
      SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY") ? "[SET]" : "[NOT SET]",
      SUPABASE_DB_URL: Deno.env.get("SUPABASE_DB_URL") ? "[SET]" : "[NOT SET]",
      
      // App configuration
      FRONTEND_URL: Deno.env.get("FRONTEND_URL"),
      
      // Email service variables
      RESEND_API_KEY: Deno.env.get("RESEND_API_KEY") ? "[SET]" : "[NOT SET]",
      SMTP_USERNAME: Deno.env.get("SMTP_USERNAME") ? "[SET]" : "[NOT SET]",
      SMTP_PASSWORD: Deno.env.get("SMTP_PASSWORD") ? "[SET]" : "[NOT SET]",
      SMTP_FROM_EMAIL: Deno.env.get("SMTP_FROM_EMAIL"),
      
      // PayPal variables
      PAYPAL_CLIENT_ID: Deno.env.get("PAYPAL_CLIENT_ID") ? "[SET]" : "[NOT SET]",
      PAYPAL_CLIENT_SECRET: Deno.env.get("PAYPAL_CLIENT_SECRET") ? "[SET]" : "[NOT SET]",
      PAYPAL_ENVIRONMENT: Deno.env.get("PAYPAL_ENVIRONMENT"),
      
      // AI service variables
      OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY") ? "[SET]" : "[NOT SET]",
    };

    // Check Deno runtime info
    const denoInfo = {
      version: Deno.version.deno,
      typescript: Deno.version.typescript,
      v8: Deno.version.v8,
    };

    // Check function deployment status
    const functionStatus = {
      timestamp: new Date().toISOString(),
      timezone: Deno.env.get("TZ") || "UTC",
      function_name: "debug-environment",
      request_method: req.method,
      request_url: req.url,
    };

    // Test basic Supabase connection (if credentials are available)
    let supabaseConnection = null;
    if (Deno.env.get("SUPABASE_URL") && Deno.env.get("SUPABASE_ANON_KEY")) {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!
        );
        
        // Test connection with a simple query
        const { data, error } = await supabase
          .from("profiles")
          .select("count", { count: "exact", head: true });
        
        supabaseConnection = {
          status: error ? "error" : "success",
          error: error?.message || null,
          can_query_profiles: !error
        };
      } catch (e) {
        supabaseConnection = {
          status: "error",
          error: e.message,
          can_query_profiles: false
        };
      }
    } else {
      supabaseConnection = {
        status: "no_credentials",
        error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY",
        can_query_profiles: false
      };
    }

    const debugInfo = {
      environment_variables: envVars,
      deno_runtime: denoInfo,
      function_status: functionStatus,
      supabase_connection: supabaseConnection,
      deployment_check: {
        function_responsive: true,
        cors_enabled: true,
        environment_accessible: true
      }
    };

    logger.debug('Debug info collected', { 
      supabaseStatus: debugInfo.supabase_connection?.status,
      functionResponsive: debugInfo.deployment_check?.function_responsive 
    });

    return new Response(
      JSON.stringify(debugInfo, null, 2),
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
      }
    );

  } catch (error: any) {
    logger.error('Error in debug-environment function', { error: error.message });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Debug check failed",
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
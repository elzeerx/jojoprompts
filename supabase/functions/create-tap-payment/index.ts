
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

// Get TAP API key from environment variables (stored in Supabase secrets)
const TAP_API_KEY = Deno.env.get("TAP_SECRET_KEY");

if (!TAP_API_KEY) {
  console.error("TAP_SECRET_KEY environment variable is not set");
}

// Construct Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS headers for security
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

// Rate limiting map (in production, use Redis or database)
const rateLimitMap = new Map();
const RATE_LIMIT = 5; // 5 requests per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userRequests = rateLimitMap.get(identifier) || [];
  
  // Remove old requests outside the window
  const validRequests = userRequests.filter((timestamp: number) => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= RATE_LIMIT) {
    return false;
  }
  
  validRequests.push(now);
  rateLimitMap.set(identifier, validRequests);
  return true;
}

function sanitizeInput(input: any): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>]/g, '').trim();
}

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
      status: 204
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ 
      error: "Method not allowed",
      code: "METHOD_NOT_ALLOWED" 
    }), {
      headers: { 
        "Content-Type": "application/json",
        ...corsHeaders 
      },
      status: 405
    });
  }

  try {
    // Check if TAP API key is configured
    if (!TAP_API_KEY) {
      console.error("TAP_SECRET_KEY not configured");
      return new Response(JSON.stringify({ 
        error: "Payment service not configured",
        code: "SERVICE_UNAVAILABLE" 
      }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
        status: 503
      });
    }

    // Get client IP for rate limiting
    const clientIP = req.headers.get("CF-Connecting-IP") || 
                     req.headers.get("X-Forwarded-For") || 
                     "unknown";

    // Apply rate limiting
    if (!checkRateLimit(clientIP)) {
      return new Response(JSON.stringify({ 
        error: "Too many requests. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED" 
      }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
        status: 429
      });
    }

    // Parse and validate request body
    const body = await req.json().catch(() => null);
    
    if (!body) {
      return new Response(JSON.stringify({ 
        error: "Invalid JSON payload",
        code: "INVALID_PAYLOAD" 
      }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
        status: 400
      });
    }

    const { planId, userId, amount, currency = "KWD" } = body;

    // Input validation and sanitization
    if (!planId || !userId || !amount) {
      return new Response(JSON.stringify({ 
        error: "Missing required fields: planId, userId, amount",
        code: "MISSING_FIELDS" 
      }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
        status: 400
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(planId) || !uuidRegex.test(userId)) {
      return new Response(JSON.stringify({ 
        error: "Invalid UUID format",
        code: "INVALID_UUID" 
      }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
        status: 400
      });
    }

    // Validate amount
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0 || numericAmount > 10000) {
      return new Response(JSON.stringify({ 
        error: "Invalid amount. Must be between 0 and 10000",
        code: "INVALID_AMOUNT" 
      }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
        status: 400
      });
    }

    // Get and validate the plan
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      console.error("Plan validation error:", planError);
      return new Response(JSON.stringify({ 
        error: "Invalid plan ID",
        code: "INVALID_PLAN" 
      }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
        status: 400
      });
    }

    // Validate amount matches plan price
    const expectedAmount = currency === "KWD" ? plan.price_kwd : plan.price_usd;
    if (Math.abs(numericAmount - expectedAmount) > 0.01) {
      console.error("Amount mismatch:", { received: numericAmount, expected: expectedAmount });
      return new Response(JSON.stringify({ 
        error: "Amount does not match plan price",
        code: "AMOUNT_MISMATCH" 
      }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
        status: 400
      });
    }

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      console.error("User validation error:", userError);
      return new Response(JSON.stringify({ 
        error: "Invalid user ID",
        code: "INVALID_USER" 
      }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
        status: 400
      });
    }

    // Get frontend URL safely
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com";

    // Create a Tap payment session with enhanced security
    const tapPayload = {
      amount: numericAmount,
      currency: sanitizeInput(currency),
      customer: {
        id: sanitizeInput(userId),
        first_name: sanitizeInput(user.first_name || "User"),
        last_name: sanitizeInput(user.last_name || ""),
      },
      source: { id: "src_card" },
      redirect: {
        url: `${frontendUrl}/payment-success`
      },
      description: `JojoPrompts - ${sanitizeInput(plan.name)} Plan`,
      metadata: {
        userId: sanitizeInput(userId),
        planId: sanitizeInput(planId),
        timestamp: new Date().toISOString()
      }
    };

    console.log("Creating TAP payment with payload:", { ...tapPayload, customer: "***" });

    const response = await fetch("https://api.tap.company/v2/charges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAP_API_KEY}`
      },
      body: JSON.stringify(tapPayload)
    });

    if (!response.ok) {
      console.error("TAP API error:", response.status, response.statusText);
      return new Response(JSON.stringify({ 
        error: "Payment service error",
        code: "PAYMENT_SERVICE_ERROR" 
      }), {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
        status: 502
      });
    }

    const data = await response.json();
    
    // Log successful payment creation (without sensitive data)
    console.log("TAP payment created successfully:", { 
      id: data.id, 
      status: data.status,
      amount: data.amount,
      currency: data.currency
    });
    
    return new Response(JSON.stringify(data), {
      headers: { 
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error("Unexpected error in create-tap-payment:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      code: "INTERNAL_ERROR" 
    }), { 
      headers: { 
        "Content-Type": "application/json",
        ...corsHeaders
      }, 
      status: 500 
    });
  }
});

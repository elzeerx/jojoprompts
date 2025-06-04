
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Security headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin"
};

// Rate limiting storage
const rateLimitMap = new Map();
const RATE_LIMIT = 3; // 3 requests per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userRequests = rateLimitMap.get(identifier) || [];
  
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
  return input.replace(/[<>]/g, '').trim().slice(0, 1000);
}

function validateAmount(amount: any): { isValid: boolean; error?: string } {
  const numericAmount = parseFloat(amount);
  if (isNaN(numericAmount) || numericAmount <= 0 || numericAmount > 10000) {
    return { isValid: false, error: "Invalid amount. Must be between 0 and 10000" };
  }
  return { isValid: true };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405
    });
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get("CF-Connecting-IP") || 
                     req.headers.get("X-Forwarded-For") || 
                     "unknown";

    if (!checkRateLimit(clientIP)) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429
      });
    }

    // Parse and validate request
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const { amount, planName, currency = "KWD" } = body;

    // Validate inputs
    if (!amount || !planName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const amountValidation = validateAmount(amount);
    if (!amountValidation.isValid) {
      return new Response(JSON.stringify({ error: amountValidation.error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Sanitize inputs
    const sanitizedPlanName = sanitizeInput(planName);
    const sanitizedCurrency = sanitizeInput(currency);

    // Get Tap API key from secrets
    const tapSecretKey = Deno.env.get("TAP_SECRET_KEY");
    if (!tapSecretKey) {
      console.error("TAP_SECRET_KEY not configured");
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503
      });
    }

    console.log("Tap configuration request:", { amount: parseFloat(amount), currency: sanitizedCurrency, planName: sanitizedPlanName });

    // Get the publishable key - this should be derived from your secret key or configured separately
    // For now, using the test publishable key, but in production you should get this from Tap dashboard
    const tapPublishableKey = "pk_test_b5JZWEaPCRy61rhY4dqMnUiw";

    // Return secure configuration for frontend
    const config = {
      publishableKey: tapPublishableKey,
      amount: parseFloat(amount),
      currency: sanitizedCurrency,
      planName: sanitizedPlanName
    };

    console.log("Tap configuration response:", { amount: config.amount, currency: config.currency });

    return new Response(JSON.stringify(config), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in create-tap-session:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});

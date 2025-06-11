
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.36.0";

const TAP_SECRET_KEY = Deno.env.get("TAP_SECRET_KEY");
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://jojoprompts.lovable.app";
const TAP_ENVIRONMENT = Deno.env.get("TAP_ENVIRONMENT") || "sandbox"; // sandbox or production

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey"
};

// Enhanced input sanitization
function sanitizeInput(input: any): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>'"]/g, '').trim().substring(0, 255);
}

// Enhanced URL sanitization
function sanitizeUrl(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

// Validate Tap API key format
function validateTapKey(key: string): boolean {
  return key && (key.startsWith('sk_test_') || key.startsWith('sk_live_'));
}

// Get Tap API base URL based on environment
function getTapApiUrl(): string {
  return TAP_ENVIRONMENT === 'production' 
    ? 'https://api.tap.company' 
    : 'https://api.tap.company'; // Tap uses same URL for both
}

// Enhanced error handling for Tap API responses
function handleTapApiError(response: any, statusCode: number): string {
  if (response.errors && Array.isArray(response.errors)) {
    return response.errors.map((err: any) => err.message || err.description).join(', ');
  }
  
  if (response.error) {
    return typeof response.error === 'string' ? response.error : response.error.message || 'Unknown error';
  }

  // Handle common Tap error status codes
  switch (statusCode) {
    case 400:
      return 'Invalid request parameters';
    case 401:
      return 'Invalid API key or unauthorized';
    case 402:
      return 'Payment required or insufficient funds';
    case 403:
      return 'Forbidden - check API permissions';
    case 404:
      return 'Resource not found';
    case 429:
      return 'Rate limit exceeded - please try again later';
    case 500:
      return 'Tap server error - please try again';
    default:
      return `Payment gateway error (${statusCode})`;
  }
}

// Validate payment amount according to Tap requirements
function validateAmount(amount: number, currency: string): boolean {
  if (amount <= 0) return false;
  
  // Tap minimum amounts by currency
  const minimums: { [key: string]: number } = {
    'USD': 0.50,
    'EUR': 0.50,
    'GBP': 0.30,
    'AED': 2.00,
    'SAR': 2.00,
    'KWD': 0.15,
    'BHD': 0.20,
    'QAR': 2.00,
    'OMR': 0.20
  };
  
  const minimum = minimums[currency.toUpperCase()] || 1.00;
  return amount >= minimum && amount <= 999999.99;
}

// Enhanced currency validation
function validateCurrency(currency: string): boolean {
  const supportedCurrencies = [
    'USD', 'EUR', 'GBP', 'AED', 'SAR', 'KWD', 'BHD', 'QAR', 'OMR'
  ];
  return supportedCurrencies.includes(currency.toUpperCase());
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ 
      error: "Method not allowed" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405
    });
  }

  try {
    // Validate Tap configuration
    if (!TAP_SECRET_KEY || !validateTapKey(TAP_SECRET_KEY)) {
      console.error("Invalid or missing TAP_SECRET_KEY");
      return new Response(JSON.stringify({ 
        error: "Payment service not properly configured" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503
      });
    }

    const body = await req.json().catch(() => null);
    
    if (!body) {
      return new Response(JSON.stringify({ 
        error: "Invalid request body" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const { planId, userId, amount, currency = "USD" } = body;

    // Enhanced validation
    if (!planId || !userId || !amount) {
      return new Response(JSON.stringify({ 
        error: "Missing required fields: planId, userId, amount" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const numericAmount = parseFloat(amount);
    const upperCurrency = currency.toUpperCase();

    // Enhanced amount and currency validation
    if (!validateAmount(numericAmount, upperCurrency)) {
      return new Response(JSON.stringify({ 
        error: `Invalid amount for ${upperCurrency}. Check minimum requirements.` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    if (!validateCurrency(upperCurrency)) {
      return new Response(JSON.stringify({ 
        error: `Unsupported currency: ${upperCurrency}` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Verify plan exists
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      console.error("Plan validation error:", planError);
      return new Response(JSON.stringify({ 
        error: "Invalid plan selected" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    // Get user profile and auth data
    const { data: user, error: userError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      console.error("User validation error:", userError);
      return new Response(JSON.stringify({ 
        error: "Invalid user" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    
    if (authError || !authUser?.user?.email) {
      console.error("Failed to get user email:", authError);
      return new Response(JSON.stringify({ 
        error: "Unable to retrieve user information" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const userEmail = authUser.user.email;

    // Enhanced redirect URLs with better parameter handling
    const successParams = new URLSearchParams({
      planId,
      userId,
      payment_method: 'tap'
    });
    const failureParams = new URLSearchParams({
      planId,
      userId,
      reason: 'Payment failed'
    });

    const successUrl = sanitizeUrl(FRONTEND_URL, `/payment-success?${successParams}`);
    const failureUrl = sanitizeUrl(FRONTEND_URL, `/payment-failed?${failureParams}`);

    console.log("Enhanced redirect URLs configured:", { successUrl, failureUrl });

    // Enhanced Tap payload with full configuration
    const tapPayload = {
      amount: numericAmount,
      currency: upperCurrency,
      threeDSecure: true,
      save_card: false,
      description: `${sanitizeInput(plan.name)} - JojoPrompts Subscription`,
      statement_descriptor: "JojoPrompts",
      metadata: {
        udf1: sanitizeInput(userId),
        udf2: sanitizeInput(planId),
        udf3: new Date().toISOString(),
        udf4: `plan_${sanitizeInput(plan.name)}`,
        udf5: TAP_ENVIRONMENT
      },
      reference: {
        transaction: `jojo_${planId}_${userId}_${Date.now()}`,
        order: `order_${Date.now()}`
      },
      receipt: {
        email: false,
        sms: false
      },
      customer: {
        first_name: sanitizeInput(user.first_name || "User"),
        last_name: sanitizeInput(user.last_name || ""),
        email: userEmail,
        phone: {
          country_code: "",
          number: ""
        }
      },
      source: {
        id: "src_all" // Accept all payment methods
      },
      post: {
        url: successUrl
      },
      redirect: {
        url: successUrl
      },
      // Enhanced configuration
      auto_capture: true,
      merchant_id: null // Will use default merchant
    };

    console.log("Creating enhanced Tap charge:", { 
      amount: tapPayload.amount, 
      currency: tapPayload.currency,
      planName: plan.name,
      reference: tapPayload.reference.transaction,
      customerEmail: userEmail,
      environment: TAP_ENVIRONMENT
    });

    // Enhanced API call with better error handling
    const tapApiUrl = getTapApiUrl();
    const response = await fetch(`${tapApiUrl}/v2/charges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAP_SECRET_KEY}`,
        "User-Agent": "JojoPrompts/1.0"
      },
      body: JSON.stringify(tapPayload)
    });

    const responseText = await response.text();
    console.log("Tap API response:", { 
      status: response.status, 
      statusText: response.statusText,
      body: responseText.substring(0, 500) // Log first 500 chars
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { error: responseText };
      }
      
      const errorMessage = handleTapApiError(errorData, response.status);
      console.error("Tap API error:", { 
        status: response.status, 
        error: errorMessage,
        response: errorData 
      });
      
      return new Response(JSON.stringify({ 
        error: "Payment gateway error",
        details: errorMessage
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Tap response:", parseError);
      return new Response(JSON.stringify({ 
        error: "Invalid response from payment gateway" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502
      });
    }

    // Enhanced response validation
    if (!data.id) {
      console.error("Tap charge creation failed - no charge ID:", data);
      return new Response(JSON.stringify({ 
        error: "Payment initialization failed" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 502
      });
    }

    // Enhanced success logging
    console.log("Tap charge created successfully:", { 
      id: data.id, 
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      transaction_url: data.transaction?.url,
      redirect_url: data.redirect?.url
    });

    // Log charge creation for audit trail
    await supabase.from("payments_log").insert({
      user_id: userId,
      tap_charge: data.id,
      status: data.status || 'initiated',
      payload: {
        plan_id: planId,
        amount: numericAmount,
        currency: upperCurrency,
        reference: tapPayload.reference.transaction
      }
    }).catch(err => console.error("Failed to log payment:", err));
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Payment creation error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" }, 
      status: 500 
    });
  }
});

// Standardized imports for all edge functions
// Version: @supabase/supabase-js@2.57.0

export { serve } from "https://deno.land/std@0.177.0/http/server.ts";
export { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

// Standard CORS headers for all functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// Standard Supabase client factory
export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Standard CORS handler
export function handleCors() {
  return new Response('ok', { headers: corsHeaders });
}

// Standard error response
export function createErrorResponse(error: string, status: number = 400) {
  return new Response(
    JSON.stringify({ error }), 
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// Standard success response
export function createSuccessResponse(data: any) {
  return new Response(
    JSON.stringify(data), 
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
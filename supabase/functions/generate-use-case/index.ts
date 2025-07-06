import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { prompt_text } = await req.json()
    console.log("Received prompt text for use case generation:", prompt_text);
    
    const authHeader = req.headers.get('Authorization')
    console.log("Authorization header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("No authorization header provided");
      throw new Error('No authorization header')
    }

    // Initialize Supabase client with better error handling
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://fxkqgjakbyrxkmevkglv.supabase.co';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a3FnamFrYnlyeGttZXZrZ2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4ODY4NjksImV4cCI6MjA2MDQ2Mjg2OX0.u4O7nvVrW6HZjZj058T9kKpEfa5BsyWT0i_p4UxcZi4';
    
    console.log("Environment check:", {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasSupabaseAnonKey: !!Deno.env.get('SUPABASE_ANON_KEY'),
      hasOpenAiKey: !!Deno.env.get('OPENAI_API_KEY')
    });

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Verify user authentication
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    console.log("User authentication check:", { 
      userExists: !!user, 
      userId: user?.id?.substring(0, 8) + '***',
      error: userError?.message 
    });
    
    if (userError || !user) {
      console.error("Authentication failed:", userError?.message);
      throw new Error(`Authentication failed: ${userError?.message || 'No user found'}`)
    }

    // Check user permissions using the database function
    const { data: canManagePromptsResult, error: permissionError } = await supabaseClient
      .rpc('can_manage_prompts', { _user_id: user.id });
    
    console.log("Permission check result:", { 
      canManagePrompts: canManagePromptsResult,
      permissionError: permissionError?.message 
    });
    
    if (permissionError) {
      console.error("Permission check failed:", permissionError);
      throw new Error(`Permission check failed: ${permissionError.message}`);
    }
    
    if (!canManagePromptsResult) {
      console.error("User lacks permissions for use case generation");
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient permissions. Only admins, prompters, and jadmins can auto-generate use cases.',
          use_case: ""
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Get user profile for logging
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, username')
      .eq('id', user.id)
      .single();
    
    console.log("User profile check:", { 
      role: userProfile?.role, 
      username: userProfile?.username,
      profileError: profileError?.message 
    });

    console.log("Authentication and permissions verified, checking OpenAI API key...");

    // Validate OpenAI API key exists
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.error("OPENAI_API_KEY environment variable is not set");
      throw new Error('OpenAI API key is not configured. Please contact the administrator.');
    }
    
    console.log("OpenAI API key found, calling OpenAI API...");

    // Call OpenAI API
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI that analyzes prompts and determines their primary use case. Respond with a concise, specific use case description in 2-4 words. Examples: "Writing Assistant", "Code Helper", "Image Generator", "Marketing Copy", "Creative Story", "Business Plan". Be specific and actionable.'
          },
          {
            role: 'user',
            content: `What is the primary use case for this prompt? ${prompt_text}`
          }
        ],
      }),
    })

    if (!openAiResponse.ok) {
      const errorDetails = await openAiResponse.text();
      console.error("OpenAI API error:", openAiResponse.status, errorDetails);
      throw new Error(`OpenAI API error: ${openAiResponse.status} ${errorDetails}`);
    }

    const openAiData = await openAiResponse.json()
    console.log("Received response from OpenAI");
    
    const useCase = openAiData.choices[0].message.content.trim();
    console.log("Generated use case:", useCase);
    
    return new Response(
      JSON.stringify({ use_case: useCase }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        use_case: ""
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
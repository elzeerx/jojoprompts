import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { createEdgeLogger } from "../_shared/logger.ts"

const logger = createEdgeLogger('GENERATE_METADATA');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to clean the OpenAI response by removing Markdown formatting
function cleanJsonResponse(text: string): string {
  logger.debug("Raw OpenAI response", { responseLength: text.length });
  
  // Check if the response is wrapped in markdown code blocks
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
  const match = text.match(jsonBlockRegex);
  
  if (match && match[1]) {
    logger.debug("Found JSON in code block, extracting");
    return match[1].trim();
  }
  
  // If no code blocks, try to find a JSON object directly
  try {
    // Check if the whole text is already valid JSON
    JSON.parse(text);
    return text;
  } catch {
    logger.debug("Response is not directly parseable as JSON, attempting to clean");
    
    // Try to find anything that looks like a JSON object
    const possibleJsonRegex = /(\{[\s\S]*\})/;
    const jsonMatch = text.match(possibleJsonRegex);
    
    if (jsonMatch && jsonMatch[1]) {
      logger.debug("Found possible JSON object in text");
      return jsonMatch[1].trim();
    }
    
    logger.debug("Could not extract JSON, returning original");
    return text;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { prompt_text } = await req.json()
    logger.info("Metadata generation request", { promptLength: prompt_text?.length });
    
    const authHeader = req.headers.get('Authorization')
    logger.debug("Auth header check", { hasAuth: !!authHeader });
    
    if (!authHeader) {
      logger.error("Missing authorization header");
      throw new Error('No authorization header')
    }

    // Initialize Supabase client with better error handling
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://fxkqgjakbyrxkmevkglv.supabase.co';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a3FnamFrYnlyeGttZXZrZ2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ4ODY4NjksImV4cCI6MjA2MDQ2Mjg2OX0.u4O7nvVrW6HZjZj058T9kKpEfa5BsyWT0i_p4UxcZi4';
    
    logger.debug("Environment check", {
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

    // Verify user authentication - extract token from Authorization header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    logger.debug("User authentication", { 
      authenticated: !!user, 
      userId: user?.id?.substring(0, 8)
    });
    
    if (userError || !user) {
      logger.error("Authentication failed", { error: userError?.message });
      throw new Error(`Authentication failed: ${userError?.message || 'No user found'}`)
    }

    // Check user permissions using the database function
    const { data: canManagePromptsResult, error: permissionError } = await supabaseClient
      .rpc('can_manage_prompts', { _user_id: user.id });
    
    logger.debug("Permission check", { 
      canManagePrompts: canManagePromptsResult
    });
    
    if (permissionError) {
      logger.error("Permission check failed", { error: permissionError.message });
      throw new Error(`Permission check failed: ${permissionError.message}`);
    }
    
    if (!canManagePromptsResult) {
      logger.warn("Insufficient permissions for metadata generation", { userId: user.id });
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient permissions. Only admins, prompters, and jadmins can auto-generate metadata.',
          style: "",
          tags: []
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
    
    logger.debug("User profile", { 
      role: userProfile?.role, 
      username: userProfile?.username
    });

    logger.info("Auth verified, checking OpenAI API key");

    // Validate OpenAI API key exists
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    logger.debug("OpenAI API key check", { hasKey: !!openAiApiKey });
    
    if (!openAiApiKey || openAiApiKey.trim() === '') {
      logger.error("Missing OPENAI_API_KEY");
      throw new Error('OpenAI API key is not configured. Please contact the administrator.');
    }
    
    logger.info("Calling OpenAI API for metadata generation");

    // Call OpenAI API - Generate only style and tags
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
            content: 'You are a helpful AI that analyzes prompts and extracts metadata. Return ONLY valid JSON with "style" (string) and "tags" (array of strings) properties. DO NOT include "category" or "use_case" - only style and tags. Do not include markdown formatting or code blocks in your response, just the raw JSON object.'
          },
          {
            role: 'user',
            content: `Analyze this prompt and provide metadata (style and tags only): ${prompt_text}`
          }
        ],
      }),
    })
    
    logger.debug("OpenAI API response", { status: openAiResponse.status });

    if (!openAiResponse.ok) {
      const errorDetails = await openAiResponse.text();
      logger.error("OpenAI API error", { status: openAiResponse.status, details: errorDetails });
      throw new Error(`OpenAI API error: ${openAiResponse.status} ${errorDetails}`);
    }

    const openAiData = await openAiResponse.json()
    logger.info("Received OpenAI response");
    
    const rawMetadataStr = openAiData.choices[0].message.content
    logger.debug("Raw metadata received", { length: rawMetadataStr?.length });
    
    // Clean the response before parsing
    const cleanedMetadataStr = cleanJsonResponse(rawMetadataStr);
    logger.debug("Metadata cleaned for parsing");
    
    try {
      const metadata = JSON.parse(cleanedMetadataStr);
      logger.debug("Metadata parsed successfully");
      
      // Ensure the metadata has the expected structure (no category)
      const validatedMetadata = {
        style: metadata.style || "",
        tags: Array.isArray(metadata.tags) ? metadata.tags : []
      };
      
      logger.info("Metadata generation successful", { 
        hasStyle: !!validatedMetadata.style,
        tagCount: validatedMetadata.tags.length 
      });
      
      return new Response(
        JSON.stringify(validatedMetadata),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (parseError) {
      logger.error("JSON parse error", { error: parseError.message });
      throw new Error(`Failed to parse metadata: ${parseError.message}`);
    }
  } catch (error) {
    logger.error('Metadata generation error', { error: error.message })
    return new Response(
      JSON.stringify({ 
        error: error.message,
        style: "",
        tags: []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
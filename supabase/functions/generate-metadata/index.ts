import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to clean the OpenAI response by removing Markdown formatting
function cleanJsonResponse(text: string): string {
  console.log("Raw OpenAI response:", text);
  
  // Check if the response is wrapped in markdown code blocks
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
  const match = text.match(jsonBlockRegex);
  
  if (match && match[1]) {
    console.log("Found JSON in code block, extracting...");
    return match[1].trim();
  }
  
  // If no code blocks, try to find a JSON object directly
  try {
    // Check if the whole text is already valid JSON
    JSON.parse(text);
    return text;
  } catch {
    console.log("Response is not directly parseable as JSON, attempting to clean...");
    
    // Try to find anything that looks like a JSON object
    const possibleJsonRegex = /(\{[\s\S]*\})/;
    const jsonMatch = text.match(possibleJsonRegex);
    
    if (jsonMatch && jsonMatch[1]) {
      console.log("Found possible JSON object in text");
      return jsonMatch[1].trim();
    }
    
    console.log("Could not extract JSON, returning original");
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
    console.log("Received prompt text for metadata generation:", prompt_text);
    
    const authHeader = req.headers.get('Authorization')
    console.log("Authorization header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("No authorization header provided");
      throw new Error('No authorization header')
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
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
      console.error("User lacks permissions for metadata generation");
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
    
    console.log("User profile check:", { 
      role: userProfile?.role, 
      username: userProfile?.username,
      profileError: profileError?.message 
    });

    console.log("Authentication and permissions verified, calling OpenAI...");

    // Call OpenAI API - Updated prompt to exclude category
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI that analyzes image generation prompts and extracts metadata. Return ONLY valid JSON with "style" and "tags" (array) properties. DO NOT include "category" - that will be set separately. Do not include markdown formatting or code blocks in your response, just the raw JSON object.'
          },
          {
            role: 'user',
            content: `Analyze this image generation prompt and provide metadata (style and tags only): ${prompt_text}`
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
    
    const rawMetadataStr = openAiData.choices[0].message.content
    console.log("Raw metadata string:", rawMetadataStr);
    
    // Clean the response before parsing
    const cleanedMetadataStr = cleanJsonResponse(rawMetadataStr);
    console.log("Cleaned metadata string:", cleanedMetadataStr);
    
    try {
      const metadata = JSON.parse(cleanedMetadataStr);
      console.log("Successfully parsed metadata:", metadata);
      
      // Ensure the metadata has the expected structure (no category)
      const validatedMetadata = {
        style: metadata.style || "",
        tags: Array.isArray(metadata.tags) ? metadata.tags : []
      };
      
      console.log("Validated metadata (without category):", validatedMetadata);
      
      return new Response(
        JSON.stringify(validatedMetadata),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "for string:", cleanedMetadataStr);
      throw new Error(`Failed to parse metadata: ${parseError.message}`);
    }
  } catch (error) {
    console.error('Error:', error)
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
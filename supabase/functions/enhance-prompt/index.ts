
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
    const { prompt_description, model_type = 'image', style_preferences = [] } = await req.json()
    console.log("Received prompt enhancement request:", { prompt_description, model_type, style_preferences });
    
    const authHeader = req.headers.get('Authorization')
    console.log("Authorization header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("No authorization header provided");
      throw new Error('No authorization header')
    }

    // Extract JWT token from Authorization header
    const token = authHeader.replace('Bearer ', '')
    console.log("JWT token extracted:", token.substring(0, 20) + '...');

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://fxkqgjakbyrxkmevkglv.supabase.co';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseServiceRoleKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY environment variable is not set");
      throw new Error('Server configuration error');
    }

    // Create service role client to validate JWT and check permissions
    const serviceRoleClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Validate JWT token using service role client
    const { data: { user }, error: userError } = await serviceRoleClient.auth.getUser(token);
    console.log("User authentication check:", { 
      userExists: !!user, 
      userId: user?.id?.substring(0, 8) + '***',
      error: userError?.message 
    });
    
    if (userError || !user) {
      console.error("Authentication failed:", userError?.message);
      throw new Error(`Authentication failed: ${userError?.message || 'No user found'}`)
    }

    // Check user permissions by querying profiles table with service role client
    const { data: profile, error: profileError } = await serviceRoleClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    console.log("User profile check:", { 
      profileExists: !!profile,
      role: profile?.role,
      profileError: profileError?.message 
    });
    
    if (profileError || !profile) {
      console.error("Profile check failed:", profileError?.message);
      throw new Error(`Profile check failed: ${profileError?.message || 'No profile found'}`);
    }
    
    // Check if user has permission to manage prompts
    const allowedRoles = ['admin', 'prompter', 'jadmin'];
    const userRole = profile.role?.toLowerCase();
    
    if (!allowedRoles.includes(userRole)) {
      console.error("User lacks permissions for prompt enhancement", { userRole, allowedRoles });
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient permissions. Only admins, prompters, and jadmins can enhance prompts.',
          enhanced_prompt: prompt_description
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Validate OpenAI API key
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log("OpenAI API key check:", { hasKey: !!openAiApiKey, keyLength: openAiApiKey?.length || 0 });
    
    if (!openAiApiKey || openAiApiKey.trim() === '') {
      console.error("OPENAI_API_KEY environment variable is not set or empty");
      throw new Error('OpenAI API key is not configured. Please contact the administrator.');
    }

    // Create system prompt based on model type
    const systemPrompt = model_type === 'video' 
      ? `You are an expert video prompt engineer. Transform basic descriptions into detailed, cinematic video prompts that capture motion, atmosphere, and visual storytelling. Focus on:
- Camera movements and angles
- Lighting and mood
- Motion and dynamics
- Scene composition
- Visual effects and transitions
- Temporal elements (timing, pacing)

Keep the core subject but expand with rich visual details that would help AI generate compelling video content. Be descriptive but concise.`
      : `You are an expert image prompt engineer. Transform basic descriptions into detailed, vivid image prompts that capture atmosphere, composition, and visual elements. Focus on:
- Visual composition and framing
- Lighting and mood
- Textures and materials
- Color palette and atmosphere
- Artistic style and technique
- Environmental details

Keep the core subject but expand with rich visual details that would help AI generate stunning images. Be descriptive but concise.`;

    // Add style preferences to the user prompt if provided
    let userPrompt = `Transform this basic description into a detailed, professional prompt: "${prompt_description}"`;
    
    if (style_preferences.length > 0) {
      userPrompt += `\n\nStyle preferences to consider: ${style_preferences.join(', ')}`;
    }

    console.log("Calling OpenAI API for prompt enhancement...");
    
    // Call OpenAI API
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model_to_use,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
    })
    
    console.log("OpenAI API response status:", openAiResponse.status);

    if (!openAiResponse.ok) {
      const errorDetails = await openAiResponse.text();
      console.error("OpenAI API error:", openAiResponse.status, errorDetails);
      throw new Error(`OpenAI API error: ${openAiResponse.status} ${errorDetails}`);
    }

    const openAiData = await openAiResponse.json()
    console.log("Received response from OpenAI");
    
    const enhancedPrompt = openAiData.choices[0].message.content.trim();
    console.log("Enhanced prompt generated:", enhancedPrompt.substring(0, 100) + "...");
    
    return new Response(
      JSON.stringify({ 
        enhanced_prompt: enhancedPrompt,
        original_prompt: prompt_description
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        enhanced_prompt: ""
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

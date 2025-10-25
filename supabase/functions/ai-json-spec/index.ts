import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { createEdgeLogger } from "../_shared/logger.ts";

const logger = createEdgeLogger('AI_JSON_SPEC');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify JWT and check permissions
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from JWT
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Check if user can manage prompts via user_roles table
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'prompter', 'jadmin'])
      .maybeSingle();

    if (roleError) {
      throw new Error('Role check failed');
    }

    if (!userRole) {
      throw new Error('Insufficient permissions');
    }

    const { user_prompt, duration_sec } = await req.json();

    if (!user_prompt || !user_prompt.trim()) {
      throw new Error('User prompt is required');
    }

    if (!duration_sec || (duration_sec !== 5 && duration_sec !== 8)) {
      throw new Error('Duration must be 5 or 8 seconds');
    }

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    logger.info('Generating JSON spec', { user_prompt, duration_sec });

    // The exact metaprompt JSON provided by the user
    const systemMessage = {
      "metaprompt": {
        "objective": "Convert any user description into a coherent, detailed JSON structure optimized for video prompt generation.",
        "core_principles": {
          "precision": "Use technical and cinematic language for all descriptions.",
          "enrichment": "Expand vague details with logical assumptions unless clarification is explicitly requested.",
          "coherence": "Ensure consistency across all fields (e.g., camera setup must match scene environment).",
          "validity": "Always output valid, well-formatted JSON with no extra commentary unless asking for missing details."
        },
        "workflow": {
          "step_1": "Ask the user whether the video duration is 5 or 8 seconds.",
          "step_2": "Break down the user description into structured fields: shot, subject, scene, visual_details.timeline, cinematography, audio, color_palette, visual_rules.",
          "step_3": "Ensure logical continuity in the timeline — actions should progress naturally with no sudden teleporting or inconsistencies.",
          "step_4": "Deliver clean, valid JSON formatted for direct use in video prompt generation."
        },
        "structure_fields": {
          "shot": [
            "composition",
            "camera_motion",
            "frame_rate",
            "lens",
            "film_grain"
          ],
          "subject": [
            "description",
            "pose",
            "emotion"
          ],
          "scene": [
            "location",
            "time_of_day",
            "environment_details"
          ],
          "visual_details": {
            "timeline": "Segmented breakdown of actions across chosen duration (5s or 8s)."
          },
          "cinematography": [
            "lighting",
            "style",
            "tone"
          ],
          "audio": [
            "ambient",
            "music",
            "dialogue"
          ],
          "color_palette": "Descriptive color mood or tint reference.",
          "visual_rules": {
            "physics_weight": "Numeric value between 0–1 defining realism intensity.",
            "prohibited_elements": [
              "Avoid cinematic artifacts not matching style",
              "Avoid teleportation or sudden inconsistencies",
              "Avoid branding or logos",
              "Avoid non-requested overlays"
            ]
          }
        },
        "constraints": [
          "Avoid vague descriptors like 'normal', 'generic', 'random'.",
          "Keep all descriptions highly visual and cinematic.",
          "Never break JSON structure."
        ]
      }
    };

    // Build user message including duration (step_1 requirement)
    const userMessage = `Duration: ${duration_sec} seconds

User description: ${user_prompt.trim()}

Please generate a complete JSON specification following the structure_fields outlined in your instructions. Ensure the timeline is segmented for ${duration_sec} seconds with logical progression.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: JSON.stringify(systemMessage)
          },
          { 
            role: 'user', 
            content: userMessage 
          }
        ],
        max_completion_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      logger.error('OpenAI API error', { status: response.status, statusText: response.statusText, errorData });
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    logger.debug('Raw OpenAI response received', { contentLength: content?.length });

    // Clean JSON response (similar pattern from generate-metadata)
    function cleanJsonResponse(text: string): any {
      try {
        // First try direct parsing
        return JSON.parse(text);
      } catch {
        // Remove markdown code blocks
        let cleanText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Try to extract JSON object
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanText = jsonMatch[0];
        }
        
        try {
          return JSON.parse(cleanText);
        } catch (parseError) {
          logger.error('Failed to parse JSON from OpenAI', { error: parseError, textLength: cleanText?.length });
          throw new Error('Invalid JSON response from AI');
        }
      }
    }

    const jsonSpec = cleanJsonResponse(content);

    // Validate required structure
    const requiredFields = ['shot', 'subject', 'scene', 'visual_details', 'cinematography', 'audio', 'color_palette', 'visual_rules'];
    const missingFields = requiredFields.filter(field => !jsonSpec.hasOwnProperty(field));
    
    if (missingFields.length > 0) {
      logger.warn('Missing required fields in JSON spec', { missingFields });
    }

    // Ensure visual_rules has physics_weight
    if (jsonSpec.visual_rules && typeof jsonSpec.visual_rules.physics_weight !== 'number') {
      jsonSpec.visual_rules.physics_weight = 0.8; // Default realistic value
    }

    const result = {
      json_spec: jsonSpec
    };

    logger.info('Generated JSON spec successfully', { duration_sec });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logger.error('Error in ai-json-spec function', { error: error.message });
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
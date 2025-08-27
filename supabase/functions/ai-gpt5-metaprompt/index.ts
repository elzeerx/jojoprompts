import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

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

    // Check if user can manage prompts
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    const canManagePrompts = ['admin', 'prompter', 'jadmin'].includes(profile.role);
    if (!canManagePrompts) {
      throw new Error('Insufficient permissions');
    }

    const { 
      subject, 
      output_format, 
      constraints = [], 
      style = [], 
      audience = [], 
      goal = [],
      quick_request = ""
    } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Generating GPT-5 metaprompt for:', { subject, output_format, constraints, style, audience, goal, quick_request });

    // The exact metaprompt_generator JSON provided by the user
    const systemMessage = {
      "metaprompt_generator": {
        "objective": "Guide GPT-5 to create a clear, structured metaprompt that instructs how to generate outputs for [SUBJECT]. The metaprompt must be reusable, adaptable, and optimized for context engineering best practices.",
        "core_principles": {
          "clarity": "Use unambiguous, plain language while keeping instructions structured.",
          "specificity": "Replace vague requests with explicit actions or examples.",
          "adaptability": "Allow the user to swap [SUBJECT] and [VARIABLES] easily without breaking structure.",
          "best_practices": [
            "Define the role or persona GPT should assume (e.g., expert, tutor, storyteller).",
            "Set constraints on style, tone, or scope.",
            "Provide structured output format (JSON, list, essay, dialogue).",
            "Include placeholders [xxxxxxx] where the user will inject their own details."
          ]
        },
        "workflow": {
          "step_1": "Ask the user what [SUBJECT] they want the metaprompt to be about.",
          "step_2": "Ask the user for [OUTPUT_FORMAT] (JSON, essay, plan, dialogue, etc.).",
          "step_3": "Ask the user for [CONSTRAINTS] such as tone, style, or limitations.",
          "step_4": "Generate a reusable metaprompt template containing clear instructions and [PLACEHOLDERS] for user-defined inputs.",
          "step_5": "Present the metaprompt wrapped in structured JSON for easy reuse."
        },
        "structure_fields": {
          "metaprompt": {
            "role_instruction": "Define GPT's role, e.g., 'You are an expert in [SUBJECT] tasked with helping the user generate [OUTPUT_TYPE]'.",
            "task_instruction": "Explicitly state the output GPT must generate, e.g., 'Produce a [OUTPUT_FORMAT] that explains [SUBJECT_DETAIL]'.",
            "constraints": "[CONSTRAINTS], e.g., keep responses under 500 words, maintain academic tone, avoid jargon.",
            "placeholders": [
              "[SUBJECT]",
              "[OUTPUT_FORMAT]",
              "[CONSTRAINTS]",
              "[STYLE]",
              "[AUDIENCE]",
              "[GOAL]"
            ],
            "example_usage": "Example: 'You are a career coach helping the user write [OUTPUT_FORMAT] for [SUBJECT]. Ensure the tone is [STYLE]. Avoid [CONSTRAINTS].'"
          }
        },
        "visual_rules": {
          "prohibited_elements": [
            "Do not leave placeholders undefined — always show them explicitly as [PLACEHOLDER].",
            "Do not break JSON validity.",
            "Do not output vague prompts like 'write something interesting'.",
            "Avoid hallucinating instructions outside user-defined context."
          ]
        },
        "output_example": {
          "metaprompt": {
            "role_instruction": "You are an expert in [SUBJECT] who will guide the user step-by-step.",
            "task_instruction": "Generate a [OUTPUT_FORMAT] that focuses on [GOAL] for an [AUDIENCE].",
            "constraints": "Maintain [STYLE] style, avoid [CONSTRAINTS].",
            "placeholders": [
              "[SUBJECT]",
              "[OUTPUT_FORMAT]",
              "[GOAL]",
              "[AUDIENCE]",
              "[STYLE]",
              "[CONSTRAINTS]"
            ]
          }
        }
      }
    };

    // Build user message
    let userMessage = `Generate a metaprompt for:
Subject: ${subject}
Output Format: ${output_format}`;

    if (constraints.length > 0) {
      userMessage += `\nConstraints: ${constraints.join(', ')}`;
    }
    if (style.length > 0) {
      userMessage += `\nStyle: ${style.join(', ')}`;
    }
    if (audience.length > 0) {
      userMessage += `\nAudience: ${audience.join(', ')}`;
    }
    if (goal.length > 0) {
      userMessage += `\nGoal: ${goal.join(', ')}`;
    }
    if (quick_request.trim()) {
      userMessage += `\nAdditional Context: ${quick_request.trim()}`;
    }

    userMessage += `\n\nPlease generate a structured JSON metaprompt following the workflow and structure_fields defined in your instructions. Generate TWO versions: one in English and one in Arabic. The response should have this structure:
{
  "metaprompt_english": { /* full metaprompt structure in English */ },
  "metaprompt_arabic": { /* full metaprompt structure in Arabic */ }
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    console.log('Raw OpenAI response:', content);

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
          console.error('Failed to parse JSON:', parseError, 'Text:', cleanText);
          throw new Error('Invalid JSON response from AI');
        }
      }
    }

    const metapromptJson = cleanJsonResponse(content);

    // Generate human-readable templates for both languages
    const generateTemplate = (mp: any) => {
      if (!mp) return "";
      return `${mp.role_instruction || ''}

${mp.task_instruction || ''}

${mp.constraints || ''}

Available placeholders: ${mp.placeholders ? mp.placeholders.join(', ') : ''}

${mp.example_usage || ''}`.trim();
    };

    const englishTemplate = generateTemplate(metapromptJson.metaprompt_english);
    const arabicTemplate = generateTemplate(metapromptJson.metaprompt_arabic);

    // Auto-suggest field values based on the inputs
    const autoFillSuggestions = {
      style: style.length > 0 ? style : [output_format.includes('academic') ? 'academic' : 'professional'],
      subject: [subject],
      effects: constraints.length > 0 ? constraints.slice(0, 3) : ['clear', 'structured'],
      audience: audience.length > 0 ? audience : ['general audience'],
      goal: goal.length > 0 ? goal : ['informative']
    };

    const result = {
      metaprompt_json: metapromptJson,
      metaprompt_template_english: englishTemplate,
      metaprompt_template_arabic: arabicTemplate,
      autofill_suggestions: autoFillSuggestions
    };

    console.log('Generated metaprompt result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-gpt5-metaprompt function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
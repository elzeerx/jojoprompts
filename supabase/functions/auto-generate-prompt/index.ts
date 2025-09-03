import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoGenerateRequest {
  category: string;
  use_case?: string;
  style?: string;
  description?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Auto-generate prompt request received');

    // Get request body
    const { category, use_case, style, description }: AutoGenerateRequest = await req.json();
    
    if (!category) {
      throw new Error('Category is required');
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Invalid auth token');
    }

    // Check if user can manage prompts
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['admin', 'prompter', 'jadmin'].includes(profile.role)) {
      throw new Error('Insufficient permissions');
    }

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Create appropriate system message based on category
    let systemMessage = '';
    let examples = '';

    switch (category.toLowerCase()) {
      case 'chatgpt':
        systemMessage = `You are an expert at creating high-quality prompts for ChatGPT and GPT models. Create effective prompts that are:
- Clear and specific with detailed instructions
- Well-structured with proper context
- Optimized for the specified use case and style
- Include relevant parameters like tone, format, and constraints`;
        examples = `Examples:
- "Act as a professional copywriter and create a compelling email subject line for a product launch. The product is a sustainable water bottle. Make it catchy, under 50 characters, and focus on the environmental benefits."
- "You are a data analyst. Analyze the following sales data and provide 3 key insights with actionable recommendations. Present your findings in bullet points with supporting data."`;
        break;

      case 'claude':
        systemMessage = `You are an expert at creating high-quality prompts for Claude AI. Create prompts that leverage Claude's analytical and reasoning capabilities:
- Use clear, structured instructions
- Encourage step-by-step thinking when appropriate
- Specify desired output format and reasoning style
- Include relevant context and constraints`;
        examples = `Examples:
- "I need you to analyze this business proposal and provide a thorough evaluation. Please think through each section step-by-step, highlighting strengths and potential concerns. Structure your response with clear headings and provide specific recommendations."
- "Help me write a research summary on climate change impacts. Use an analytical approach, cite key points, and present the information in a well-organized format with clear sections for causes, effects, and solutions."`;
        break;

      case 'midjourney':
        systemMessage = `You are an expert at creating detailed Midjourney prompts for image generation. Create prompts that include:
- Specific visual descriptions with artistic details
- Appropriate Midjourney parameters (--ar, --v, --s, --q)
- Style references and lighting descriptions
- Composition and mood specifications`;
        examples = `Examples:
- "A majestic dragon soaring over a medieval castle at golden hour, cinematic lighting, detailed scales, dramatic clouds, fantasy art style --ar 16:9 --v 6 --q 2"
- "Portrait of a cyberpunk warrior in neon-lit city streets, futuristic armor, rain-soaked ground reflections, moody atmosphere --ar 9:16 --s 750 --v 6"`;
        break;

      case 'video':
        systemMessage = `You are an expert at creating video generation prompts. Create prompts that specify:
- Scene description with detailed visual elements
- Camera movements and angles
- Timing and duration specifications
- Style and mood parameters`;
        examples = `Examples:
- "A drone shot slowly rising above a misty forest at dawn, revealing a hidden waterfall, cinematic color grading, 10 seconds, smooth camera movement"
- "Close-up of hands kneading bread dough, warm kitchen lighting, flour particles in the air, slow motion, cozy atmosphere, 5 seconds"`;
        break;

      default:
        systemMessage = `You are an expert at creating high-quality AI prompts. Create clear, specific prompts that:
- Include detailed instructions and context
- Specify desired output format and style
- Are optimized for the intended use case
- Include relevant constraints and parameters`;
    }

    // Build user message
    let userMessage = `Create a professional ${category} prompt`;
    
    if (use_case) {
      userMessage += ` for ${use_case}`;
    }
    
    if (style) {
      userMessage += ` with a ${style} style`;
    }
    
    if (description) {
      userMessage += `. Additional context: ${description}`;
    }
    
    userMessage += `\n\nGenerate only the prompt text, no additional explanation. Make it specific, actionable, and optimized for best results.`;

    // Make request to OpenAI
    console.log('Sending request to OpenAI API...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: `${systemMessage}\n\n${examples}\n\nAlways create prompts that are professional, clear, and optimized for the specific AI model and use case.`
          },
          { role: 'user', content: userMessage }
        ],
        max_completion_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI API response received');

    const generatedPrompt = data.choices[0]?.message?.content;
    if (!generatedPrompt) {
      throw new Error('No content generated');
    }

    // Also generate a title
    const titleResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: 'Create a concise, descriptive title for the given prompt. The title should be 3-8 words and clearly indicate what the prompt does.'
          },
          { role: 'user', content: `Create a title for this prompt: ${generatedPrompt}` }
        ],
        max_completion_tokens: 50
      }),
    });

    let generatedTitle = 'Generated Prompt';
    if (titleResponse.ok) {
      const titleData = await titleResponse.json();
      generatedTitle = titleData.choices[0]?.message?.content?.replace(/['"]/g, '') || generatedTitle;
    }

    return new Response(JSON.stringify({ 
      prompt: generatedPrompt,
      title: generatedTitle,
      category 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in auto-generate-prompt function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to generate prompt'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
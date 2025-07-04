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
    console.log("Received prompt text for use case generation:", prompt_text);
    
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

    console.log("Authentication verified, calling OpenAI...");

    // Call OpenAI API to generate use case
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
            content: 'You are a helpful AI that analyzes prompts and suggests appropriate use cases. Return ONLY valid JSON with a "use_case" property containing a concise, descriptive use case (2-4 words). Examples: "Content Creation", "Code Generation", "Data Analysis", "Creative Writing", "Email Assistant", "Research Helper". Do not include markdown formatting or code blocks in your response, just the raw JSON object.'
          },
          {
            role: 'user',
            content: `Analyze this prompt and suggest the most appropriate use case: ${prompt_text}`
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
    
    const rawUseCaseStr = openAiData.choices[0].message.content
    console.log("Raw use case string:", rawUseCaseStr);
    
    // Clean the response before parsing
    const cleanedUseCaseStr = cleanJsonResponse(rawUseCaseStr);
    console.log("Cleaned use case string:", cleanedUseCaseStr);
    
    try {
      const useCaseData = JSON.parse(cleanedUseCaseStr);
      console.log("Successfully parsed use case data:", useCaseData);
      
      // Ensure the data has the expected structure
      const validatedUseCase = {
        use_case: useCaseData.use_case || ""
      };
      
      console.log("Validated use case:", validatedUseCase);
      
      return new Response(
        JSON.stringify(validatedUseCase),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "for string:", cleanedUseCaseStr);
      throw new Error(`Failed to parse use case: ${parseError.message}`);
    }
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
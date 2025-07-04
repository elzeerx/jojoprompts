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
    console.log("=== Generate Use Case Function Started ===");
    console.log("Request method:", req.method);
    console.log("Request headers:", Object.fromEntries(req.headers.entries()));
    
    let requestBody;
    try {
      requestBody = await req.json();
      console.log("Request body parsed successfully:", requestBody);
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      throw new Error('Invalid request body');
    }
    
    const { prompt_text } = requestBody;
    
    if (!prompt_text || typeof prompt_text !== 'string') {
      console.error("Invalid or missing prompt_text:", prompt_text);
      throw new Error('prompt_text is required and must be a string');
    }
    
    console.log("Prompt text received:", {
      length: prompt_text.length,
      preview: prompt_text.substring(0, 100) + '...'
    });
    
    const authHeader = req.headers.get('Authorization');
    console.log("Authorization header check:", {
      present: !!authHeader,
      format: authHeader ? authHeader.substring(0, 20) + '***' : 'none'
    });
    
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required',
          use_case: ""
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.error("Invalid authorization header format");
      return new Response(
        JSON.stringify({ 
          error: 'Invalid authorization format',
          use_case: ""
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Initialize Supabase client with enhanced error handling
    console.log("Initializing Supabase client...");
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase environment variables:", {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey
      });
      throw new Error('Supabase configuration missing');
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { 
          Authorization: authHeader,
          'apikey': supabaseAnonKey
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    console.log("Supabase client initialized, verifying authentication...");
    
    // Verify user authentication with enhanced error handling
    let authResult;
    try {
      authResult = await supabaseClient.auth.getUser();
      console.log("Auth result received:", {
        hasData: !!authResult.data,
        hasUser: !!authResult.data?.user,
        hasError: !!authResult.error
      });
    } catch (authError) {
      console.error("Auth verification failed with exception:", authError);
      return new Response(
        JSON.stringify({ 
          error: 'Authentication verification failed',
          use_case: ""
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    const { data: { user }, error: userError } = authResult;
    
    console.log("User authentication details:", { 
      userExists: !!user, 
      userId: user?.id ? user.id.substring(0, 8) + '***' : 'none',
      userEmail: user?.email ? user.email.substring(0, 3) + '***' : 'none',
      errorMessage: userError?.message,
      errorCode: userError?.code
    });
    
    if (userError) {
      console.error("Authentication error details:", {
        message: userError.message,
        code: userError.code,
        details: userError
      });
      return new Response(
        JSON.stringify({ 
          error: `Authentication failed: ${userError.message}`,
          use_case: ""
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    
    if (!user) {
      console.error("No user found in authentication result");
      return new Response(
        JSON.stringify({ 
          error: 'No authenticated user found',
          use_case: ""
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log("Authentication verified successfully, proceeding to OpenAI API call...");

    // Validate OpenAI API key
    const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiApiKey) {
      console.error("OpenAI API key not found in environment variables");
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API key not configured',
          use_case: ""
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log("OpenAI API key found, making API call...");
    
    // Call OpenAI API to generate use case with enhanced error handling
    let openAiResponse;
    try {
      openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: 'You are a helpful AI that analyzes prompts and suggests appropriate use cases. Return ONLY valid JSON with a "use_case" property containing a concise, descriptive use case (2-4 words). Examples: "Content Creation", "Code Generation", "Data Analysis", "Creative Writing", "Email Assistant", "Research Helper". Do not include markdown formatting or code blocks in your response, just the raw JSON object.'
            },
            {
              role: 'user',
              content: `Analyze this prompt and suggest the most appropriate use case: ${prompt_text}`
            }
          ],
          max_tokens: 100,
          temperature: 0.3
        }),
      });
      
      console.log("OpenAI API response received:", {
        status: openAiResponse.status,
        statusText: openAiResponse.statusText,
        ok: openAiResponse.ok
      });
      
    } catch (fetchError) {
      console.error("Failed to call OpenAI API:", fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to connect to OpenAI API',
          use_case: ""
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!openAiResponse.ok) {
      let errorDetails;
      try {
        errorDetails = await openAiResponse.text();
      } catch (e) {
        errorDetails = 'Unable to read error response';
      }
      console.error("OpenAI API error:", {
        status: openAiResponse.status,
        statusText: openAiResponse.statusText,
        details: errorDetails
      });
      return new Response(
        JSON.stringify({ 
          error: `OpenAI API error: ${openAiResponse.status}`,
          use_case: ""
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    let openAiData;
    try {
      openAiData = await openAiResponse.json();
      console.log("OpenAI response parsed successfully:", {
        hasChoices: !!openAiData.choices,
        choicesLength: openAiData.choices?.length,
        hasContent: !!openAiData.choices?.[0]?.message?.content
      });
    } catch (jsonError) {
      console.error("Failed to parse OpenAI response as JSON:", jsonError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid response from OpenAI API',
          use_case: ""
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    if (!openAiData.choices || !openAiData.choices[0] || !openAiData.choices[0].message) {
      console.error("Invalid OpenAI response structure:", openAiData);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid OpenAI response structure',
          use_case: ""
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    const rawUseCaseStr = openAiData.choices[0].message.content;
    console.log("Raw use case string from OpenAI:", rawUseCaseStr);
    
    if (!rawUseCaseStr) {
      console.error("Empty content from OpenAI");
      return new Response(
        JSON.stringify({ 
          error: 'Empty response from OpenAI',
          use_case: ""
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    // Clean the response before parsing
    const cleanedUseCaseStr = cleanJsonResponse(rawUseCaseStr);
    console.log("Cleaned use case string:", cleanedUseCaseStr);
    
    let useCaseData;
    try {
      useCaseData = JSON.parse(cleanedUseCaseStr);
      console.log("Successfully parsed use case data:", useCaseData);
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "for string:", cleanedUseCaseStr);
      // Fallback: try to extract a simple use case from the text
      const fallbackUseCase = rawUseCaseStr.replace(/[^a-zA-Z\s]/g, '').trim().slice(0, 50);
      console.log("Using fallback use case:", fallbackUseCase);
      return new Response(
        JSON.stringify({ 
          use_case: fallbackUseCase || "General Use"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
      
    // Ensure the data has the expected structure
    const validatedUseCase = {
      use_case: (useCaseData.use_case || useCaseData.useCase || "").toString().trim() || "General Use"
    };
    
    console.log("Final validated use case:", validatedUseCase);
    console.log("=== Generate Use Case Function Completed Successfully ===");
    
    return new Response(
      JSON.stringify(validatedUseCase),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('=== Generate Use Case Function Error ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', error);
    
    // Determine appropriate error response based on error type
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    
    if (error.message?.includes('Authentication') || error.message?.includes('authorization')) {
      statusCode = 401;
      errorMessage = error.message;
    } else if (error.message?.includes('OpenAI')) {
      statusCode = 502;
      errorMessage = 'AI service temporarily unavailable';
    } else if (error.message?.includes('prompt_text')) {
      statusCode = 400;
      errorMessage = error.message;
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        use_case: "",
        debug: {
          timestamp: new Date().toISOString(),
          errorType: error.constructor.name
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: statusCode }
    )
  }
})
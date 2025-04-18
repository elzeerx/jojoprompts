
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create client that forwards the caller's JWT
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // Auth check
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }), 
        { status: 401, headers: corsHeaders }
      );
    }

    // Get existing prompts for context
    const { data: prompts } = await supabase
      .from('prompts')
      .select('prompt_text, metadata')
      .limit(5);

    // Call OpenAI API
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
            content: 'You are an AI that creates unique and creative image generation prompts. Based on example prompts, create a new prompt with similar style and metadata.'
          },
          {
            role: 'user',
            content: `Here are some example prompts: ${JSON.stringify(prompts)}. Create a new unique prompt with metadata.`
          }
        ],
      }),
    });

    const openAiData = await openAiResponse.json();
    const newPrompt = JSON.parse(openAiData.choices[0].message.content);

    // Insert the generated prompt
    const { data: inserted, error: insertErr } = await supabase
      .from("prompts")
      .insert({
        user_id: user.id,
        title: newPrompt.title,
        prompt_text: newPrompt.prompt_text,
        metadata: newPrompt.metadata || {},
        image_path: null,
      })
      .select("id, title")
      .single();

    if (insertErr) {
      console.error("Error inserting prompt:", insertErr);
      return new Response(
        JSON.stringify({ error: insertErr.message }), 
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify(inserted),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: corsHeaders }
    );
  }
});

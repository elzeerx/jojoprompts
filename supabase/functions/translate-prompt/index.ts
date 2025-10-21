import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from '../_shared/cors.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('translate-prompt: Starting request');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('translate-prompt: No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract user ID from JWT token (avoiding auth.getUser() call)
    const token = authHeader.replace('Bearer ', '');
    let userId;
    try {
      // Decode JWT payload (base64url decode the middle part)
      const [, payload] = token.split('.');
      const decodedPayload = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      userId = decodedPayload.sub;
      
      if (!userId) {
        throw new Error('No user ID in token');
      }
      console.log('translate-prompt: Extracted user ID from token');
    } catch (error) {
      console.log('translate-prompt: Invalid token format', error);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: canManage } = await supabase.rpc('can_manage_prompts', { _user_id: userId });
    if (!canManage) {
      console.log('translate-prompt: User cannot manage prompts');
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt_id, target_language, overwrite = false } = await req.json();
    console.log('translate-prompt: Request params', { prompt_id, target_language, overwrite });

    if (!prompt_id || !target_language || !['arabic', 'english'].includes(target_language)) {
      return new Response(
        JSON.stringify({ error: 'Invalid parameters. prompt_id and target_language (arabic|english) required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the prompt
    const { data: prompt, error: fetchError } = await supabase
      .from('prompts')
      .select('id, title, prompt_text, metadata')
      .eq('id', prompt_id)
      .single();

    if (fetchError || !prompt) {
      console.log('translate-prompt: Prompt not found', fetchError);
      return new Response(
        JSON.stringify({ error: 'Prompt not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metadata = prompt.metadata || {};
    const translations = metadata.translations || {};

    // Check if translation already exists
    if (translations[target_language] && !overwrite) {
      console.log('translate-prompt: Translation already exists');
      return new Response(
        JSON.stringify({ 
          status: 'already_translated',
          message: `${target_language} translation already exists`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine source text and language
    let sourceTitle = prompt.title;
    let sourceText = prompt.prompt_text;
    let sourceLanguage = 'english';

    if (target_language === 'english') {
      // Translating to English - prefer Arabic source if available
      if (translations.arabic?.title) {
        sourceTitle = translations.arabic.title;
        sourceLanguage = 'arabic';
      }
      if (translations.arabic?.prompt_text) {
        sourceText = translations.arabic.prompt_text;
        sourceLanguage = 'arabic';
      }
    } else {
      // Translating to Arabic - prefer English source if available
      if (translations.english?.title) {
        sourceTitle = translations.english.title;
        sourceLanguage = 'english';
      }
      if (translations.english?.prompt_text) {
        sourceText = translations.english.prompt_text;
        sourceLanguage = 'english';
      }
    }

    if (!sourceText || sourceText.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Source text is too short or empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('translate-prompt: Calling OpenAI', { sourceLanguage, target_language });

    // Call OpenAI for translation
    const translationPrompt = `You are a professional translator. Translate the following prompt title and text from ${sourceLanguage} to ${target_language}.

CRITICAL REQUIREMENTS:
- Preserve ALL placeholders exactly: {variables}, {{handlebars}}, <xml>, [brackets], markdown formatting, code blocks
- Keep line breaks and paragraph structure
- Maintain technical terms and formatting
- Do NOT add disclaimers, explanations, or meta-commentary
- Return ONLY valid JSON in this exact format: {"title": "translated title", "prompt_text": "translated text"}

Source Title: ${sourceTitle}

Source Text:
${sourceText}`;

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a professional translator that returns only valid JSON responses.' },
          { role: 'user', content: translationPrompt }
        ],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    if (!openAIResponse.ok) {
      console.error('translate-prompt: OpenAI API error', await openAIResponse.text());
      return new Response(
        JSON.stringify({ error: 'Translation service unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openAIData = await openAIResponse.json();
    let translatedContent = openAIData.choices[0].message.content.trim();

    // Clean up potential JSON fencing
    if (translatedContent.startsWith('```json')) {
      translatedContent = translatedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (translatedContent.startsWith('```')) {
      translatedContent = translatedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let translation;
    try {
      translation = JSON.parse(translatedContent);
    } catch (parseError) {
      console.error('translate-prompt: Failed to parse OpenAI response', { translatedContent, parseError });
      return new Response(
        JSON.stringify({ error: 'Translation parsing failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!translation.title || !translation.prompt_text) {
      console.error('translate-prompt: Invalid translation format', translation);
      return new Response(
        JSON.stringify({ error: 'Invalid translation format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the prompt metadata
    const updatedTranslations = {
      ...translations,
      [target_language]: {
        title: translation.title,
        prompt_text: translation.prompt_text
      }
    };

    const updatedMetadata = {
      ...metadata,
      translations: updatedTranslations
    };

    const { error: updateError } = await supabase
      .from('prompts')
      .update({ metadata: updatedMetadata })
      .eq('id', prompt_id);

    if (updateError) {
      console.error('translate-prompt: Failed to update prompt', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save translation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('translate-prompt: Translation completed successfully');

    return new Response(
      JSON.stringify({
        updated: true,
        target_language,
        translation,
        message: `Successfully translated to ${target_language}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('translate-prompt: Unexpected error', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
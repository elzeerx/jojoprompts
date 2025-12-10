import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createEdgeLogger } from '../_shared/logger.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const logger = createEdgeLogger('translate-text');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, targetLanguage, sourceLanguage } = await req.json();

    if (!text || !targetLanguage) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: text and targetLanguage' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const languageMap = {
      'en': 'English',
      'ar': 'Arabic'
    };

    const targetLangName = languageMap[targetLanguage as keyof typeof languageMap];
    const sourceLangName = sourceLanguage ? languageMap[sourceLanguage as keyof typeof languageMap] : 'detected language';

    if (!targetLangName) {
      return new Response(
        JSON.stringify({ error: 'Unsupported target language' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const prompt = `Translate the following text to ${targetLangName}. 
${sourceLangName ? `The source language is ${sourceLangName}.` : ''}
Maintain the same tone, style, and meaning. For AI prompts, preserve technical terms and formatting.

Text to translate:
"${text}"

Translation:`;

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
            content: 'You are a professional translator. Provide accurate, natural translations while preserving the original meaning and context. For AI prompts and technical content, maintain formatting and technical terminology.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      logger.error('OpenAI API error', { status: response.status, statusText: response.statusText });
      return new Response(
        JSON.stringify({ error: 'Translation service unavailable' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    const translatedText = data.choices[0].message.content.trim();

    // Clean up the translation (remove quotes if they were added)
    const cleanedTranslation = translatedText.replace(/^["']|["']$/g, '');

    return new Response(
      JSON.stringify({ 
        translatedText: cleanedTranslation,
        sourceLanguage: sourceLanguage || 'auto',
        targetLanguage 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    logger.error('Translation error', { error });
    return new Response(
      JSON.stringify({ error: 'Translation failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
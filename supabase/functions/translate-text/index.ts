import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { createEdgeLogger } from '../_shared/logger.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

const MAX_TEXT = 10_000;
const ALLOWED_LANGS = new Set(['en', 'ar']);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  const logger = createEdgeLogger('translate-text');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  // Auth: bearer + can_manage_prompts (admin publishing utility).
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json(401, { error: 'Unauthorized' });

  const { data: canManage, error: permErr } = await supabase.rpc('can_manage_prompts', {
    _user_id: user.id,
  });
  if (permErr || !canManage) return json(403, { error: 'Forbidden' });

  try {
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === 'string' ? body.text : '';
    const targetLanguage = typeof body?.targetLanguage === 'string' ? body.targetLanguage : '';
    const sourceLanguage = typeof body?.sourceLanguage === 'string' ? body.sourceLanguage : undefined;

    if (!text || text.length > MAX_TEXT) return json(400, { error: 'Invalid text length' });
    if (!ALLOWED_LANGS.has(targetLanguage)) return json(400, { error: 'Unsupported language' });
    if (sourceLanguage !== undefined && !ALLOWED_LANGS.has(sourceLanguage)) {
      return json(400, { error: 'Unsupported language' });
    }

    if (!openAIApiKey) {
      logger.error('OPENAI_API_KEY missing');
      return json(503, { error: 'Translation service unavailable' });
    }

    const targetLangName = targetLanguage === 'ar' ? 'Arabic' : 'English';
    const sourceLangName = sourceLanguage === 'ar' ? 'Arabic' : sourceLanguage === 'en' ? 'English' : 'detected language';

    const prompt = `Translate the following text to ${targetLangName}. The source language is ${sourceLangName}. Preserve tone, style, and meaning. For AI prompts, preserve technical terms and formatting.

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
          { role: 'system', content: 'You are a professional translator. Provide accurate, natural translations while preserving the original meaning and context.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      logger.error('OpenAI API error', { status: response.status });
      return json(502, { error: 'Translation service unavailable' });
    }

    const data = await response.json();
    const raw = String(data?.choices?.[0]?.message?.content ?? '').trim();
    const cleanedTranslation = raw.replace(/^["']|["']$/g, '');

    return json(200, {
      translatedText: cleanedTranslation,
      sourceLanguage: sourceLanguage || 'auto',
      targetLanguage,
    });
  } catch (_error) {
    logger.error('Translation error');
    return json(500, { error: 'Translation failed' });
  }
});

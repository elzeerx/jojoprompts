import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeLogger } from '../_shared/logger.ts';
import { SuggestPromptSchema, validateAIInput } from "../_shared/aiValidation.ts";

const logger = createEdgeLogger('suggest-prompt');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    let requestBody: unknown = {};
    try { requestBody = await req.json(); } catch { requestBody = {}; }

    const validation = validateAIInput(SuggestPromptSchema, requestBody);
    if (!validation.success) return json(400, { error: validation.error });

    // Auth + can_manage_prompts BEFORE reading prompts / calling OpenAI / insert.
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'Unauthorized' });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json(401, { error: 'Unauthorized' });

    const { data: canManage, error: permErr } = await supabase.rpc('can_manage_prompts', {
      _user_id: user.id,
    });
    if (permErr || !canManage) return json(403, { error: 'Forbidden' });

    const { data: prompts } = await supabase
      .from('prompts')
      .select('prompt_text, metadata')
      .limit(5);

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
            content: 'You are an AI that creates unique and creative image generation prompts. Respond with strict JSON containing "title", "prompt_text", and "metadata" fields only.',
          },
          {
            role: 'user',
            content: `Here are some example prompts: ${JSON.stringify(prompts)}. Create a new unique prompt as JSON.`,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!openAiResponse.ok) {
      logger.error('OpenAI error', { status: openAiResponse.status });
      return json(502, { error: 'AI service unavailable' });
    }

    const openAiData = await openAiResponse.json();
    const raw = openAiData?.choices?.[0]?.message?.content;
    let newPrompt: Record<string, unknown> | null = null;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      newPrompt = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch {
      newPrompt = null;
    }
    if (!newPrompt) return json(502, { error: 'AI response malformed' });

    const title = typeof newPrompt.title === 'string' ? newPrompt.title : 'Untitled';
    const promptText = typeof newPrompt.prompt_text === 'string'
      ? newPrompt.prompt_text
      : typeof newPrompt.prompt === 'string'
        ? newPrompt.prompt
        : null;
    if (!promptText) return json(502, { error: 'AI response missing prompt_text' });

    const metadata =
      newPrompt.metadata && typeof newPrompt.metadata === 'object'
        ? newPrompt.metadata
        : {};

    const { data: inserted, error: insErr } = await supabase
      .from("prompts")
      .insert({
        user_id: user.id,
        title,
        prompt_text: promptText,
        metadata,
      })
      .select("id, title")
      .single();

    if (insErr) {
      logger.error('Insert error');
      return json(500, { error: 'Insert failed' });
    }

    return json(200, inserted);
  } catch (_error) {
    logger.error('suggest-prompt error');
    return json(500, { error: 'Internal error' });
  }
});

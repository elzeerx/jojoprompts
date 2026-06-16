// AI Studio chat endpoint.
// Calls Lovable AI Gateway (OpenAI-compatible) with conversation history and an
// `emit_asset` tool the model can call to publish a structured draft payload
// back to the client preview pane.

import { corsHeaders } from "../_shared/cors.ts";
import { verifyAdmin } from "../_shared/adminAuth.ts";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  kind?: string;
  targetLlm?: string;
  model?: string;
}

const SYSTEM_PROMPT = `You are JojoPrompts AI Studio — an assistant that helps admins create high-quality prompt assets for an AI prompt marketplace.

You can generate any of these asset kinds:
- "text"     : a freeform text prompt (markdown) for ChatGPT / Claude / Manus / Gemini.
- "json"     : a structured JSON prompt or spec (return valid JSON).
- "skill"    : a Claude/Manus skill package (name, description, instructions, optional scripts).
- "image"    : an image generation prompt (Midjourney / SD / GPT-image) with params like aspect ratio, style.
- "workflow" : an n8n / Zapier / automation workflow JSON.
- "other"    : anything else (video prompt, audio prompt, agent system message…).

CRITICAL: when you have a complete or refined asset, ALWAYS call the \`emit_asset\` tool with the structured payload, in addition to your conversational reply. The user's preview pane only updates from \`emit_asset\` tool calls. Re-emit on every revision.

Keep chat replies short and conversational. Put the actual content inside the \`emit_asset\` payload. Ask one clarifying question if the brief is ambiguous, otherwise produce the asset.`;

const EMIT_ASSET_TOOL = {
  type: "function" as const,
  function: {
    name: "emit_asset",
    description:
      "Push the latest version of the generated asset to the admin's preview pane. Call this whenever you produce or revise the asset.",
    parameters: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["text", "json", "skill", "image", "workflow", "other"],
          description: "Asset type.",
        },
        title: { type: "string", description: "Short title for the asset." },
        body: {
          type: "string",
          description:
            "Main content as markdown (the prompt text, skill instructions, image-prompt description, etc.). Required for all kinds except pure JSON.",
        },
        json: {
          type: "object",
          description:
            "Structured JSON payload (for kind=json / workflow / skill files). Omit for plain text prompts.",
        },
        params: {
          type: "object",
          description:
            "Optional parameters (e.g. image aspect_ratio, style, target model, temperature).",
        },
        target_llm: {
          type: "string",
          description:
            "Target model/platform this asset is best used with (chatgpt, claude, manus, gemini, midjourney, generic).",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Suggested tags for cataloging.",
        },
        language: {
          type: "string",
          enum: ["en", "ar", "bilingual"],
          description: "Primary language of the asset.",
        },
      },
      required: ["kind", "title"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await verifyAdmin(req);
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages[] is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const kindHint = body.kind ? `\n\nDefault asset kind for this session: "${body.kind}".` : "";
  const llmHint = body.targetLlm
    ? `\nDefault target LLM: "${body.targetLlm}".`
    : "";

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT + kindHint + llmHint },
    ...body.messages,
  ];

  const gatewayBody = {
    model: body.model || DEFAULT_MODEL,
    messages,
    tools: [EMIT_ASSET_TOOL],
    tool_choice: "auto" as const,
  };

  const aiRes = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(gatewayBody),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    let userMessage = "AI request failed";
    if (aiRes.status === 429) userMessage = "Rate limit reached. Please try again in a moment.";
    else if (aiRes.status === 402) userMessage = "AI credits exhausted. Please top up in workspace billing.";
    return new Response(
      JSON.stringify({ error: userMessage, status: aiRes.status, detail: errText.slice(0, 500) }),
      { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const data = await aiRes.json();
  const choice = data?.choices?.[0]?.message ?? {};
  const toolCalls = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];

  // Extract the latest emit_asset payload, if any.
  let asset: unknown = null;
  for (const call of toolCalls) {
    if (call?.function?.name === "emit_asset") {
      try {
        asset = JSON.parse(call.function.arguments || "{}");
      } catch {
        // ignore parse failures
      }
    }
  }

  return new Response(
    JSON.stringify({
      reply: typeof choice.content === "string" ? choice.content : "",
      asset,
      raw_tool_calls: toolCalls,
      usage: data?.usage ?? null,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

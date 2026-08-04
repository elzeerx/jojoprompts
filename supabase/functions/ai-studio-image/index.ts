// AI Studio image generation endpoint.
// Streams partial PNG frames from the Lovable AI Gateway image endpoint via SSE.
// The client (ImagePreviewStream.tsx) parses `image_generation.partial_image`
// and `image_generation.completed` events and renders each one.

import { corsHeaders } from "../_shared/cors.ts";
import { verifyAdmin } from "../_shared/adminAuth.ts";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/images/generations";

interface ImageRequest {
  prompt: string;
  model?: string;
  size?: string;
}

const OPENAI_MODELS = new Set([
  "openai/gpt-image-2",
  "openai/gpt-image-1-mini",
]);

const GEMINI_MODELS = new Set([
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image",
  "google/gemini-3.1-flash-image",
]);

const DEFAULT_MODEL = "google/gemini-3-pro-image";

function isSupportedModel(model: string): boolean {
  return OPENAI_MODELS.has(model) || GEMINI_MODELS.has(model);
}

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

  let body: ImageRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt) {
    return new Response(JSON.stringify({ error: "prompt is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const model = body.model || "google/gemini-3.1-flash-image-preview";
  const size = body.size || "1024x1024";

  // Build per-model body (OpenAI uses prompt; Gemini uses messages + modalities).
  const upstreamBody: Record<string, unknown> = OPENAI_MODELS.has(model)
    ? {
        model,
        prompt,
        size,
        quality: "low",
        stream: true,
        partial_images: 1,
      }
    : {
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
        stream: true,
      };

  const aiRes = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(upstreamBody),
  });

  if (!aiRes.ok || !aiRes.body) {
    const errText = await aiRes.text().catch(() => "");
    let userMessage = "Image generation failed";
    if (aiRes.status === 429) userMessage = "Rate limit reached. Try again shortly.";
    else if (aiRes.status === 402) userMessage = "AI credits exhausted.";
    return new Response(
      JSON.stringify({ error: userMessage, status: aiRes.status, detail: errText.slice(0, 500) }),
      { status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // SSE passthrough — stream the upstream body to the client unchanged.
  return new Response(aiRes.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});

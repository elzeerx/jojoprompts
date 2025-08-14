// OpenAI model alias mapping for frontend usage
// We accept the requested external id and map it to an available model id

export const OPENAI_MODEL_ALIAS = "gpt-5-mini-2025-08-07";

export function mapOpenAIModel(requested?: string): string {
  const id = (requested || OPENAI_MODEL_ALIAS).toLowerCase();
  const map: Record<string, string> = {
    // Requested by product requirements
    "gpt-5-mini-2025-08-07": "gpt-4.1-2025-04-14",

    // Friendly fallbacks and legacy names
    "gpt-4.1-mini": "gpt-4.1-2025-04-14",
    "gpt-4o-mini": "gpt-4o-mini", // legacy but still usable
    "o4-mini-2025-04-16": "o4-mini-2025-04-16",
  };
  return map[id] || "gpt-4.1-2025-04-14";
}

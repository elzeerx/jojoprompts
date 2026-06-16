import { z } from "zod";

/**
 * Target LLM/tool for formatting JSON prompts into a human-readable string.
 */
export type PromptTarget = "chatgpt" | "claude" | "midjourney" | "gemini" | "generic";

/**
 * Zod schema for an accepted JSON prompt shape.
 * Intentionally lenient — most fields optional so users can paste varied JSON.
 */
export const JsonPromptSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    content: z.string().optional(),
    prompt: z.string().optional(),
    system: z.string().optional(),
    instructions: z.string().optional(),
    messages: z
      .array(
        z.object({
          role: z.string(),
          content: z.string(),
        })
      )
      .optional(),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
    target_model: z.string().optional(),
    parameters: z.record(z.any()).optional(),
    // Midjourney-style flags
    aspect_ratio: z.string().optional(),
    version: z.string().optional(),
    stylize: z.union([z.string(), z.number()]).optional(),
    chaos: z.union([z.string(), z.number()]).optional(),
    quality: z.union([z.string(), z.number()]).optional(),
    seed: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export type JsonPrompt = z.infer<typeof JsonPromptSchema>;

export interface ParseResult {
  ok: boolean;
  /** Always an array — single objects are normalised to [obj] */
  prompts: JsonPrompt[];
  error?: string;
}

/**
 * Parse a raw JSON string. Accepts a single object or an array of objects.
 */
export function parseJsonPrompts(raw: string): ParseResult {
  if (!raw.trim()) {
    return { ok: false, prompts: [], error: "Input is empty." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e: any) {
    return { ok: false, prompts: [], error: `Invalid JSON: ${e.message}` };
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  const prompts: JsonPrompt[] = [];
  for (let i = 0; i < items.length; i++) {
    const result = JsonPromptSchema.safeParse(items[i]);
    if (!result.success) {
      const first = result.error.errors[0];
      return {
        ok: false,
        prompts: [],
        error: `Item ${i + 1}: ${first.path.join(".") || "root"} — ${first.message}`,
      };
    }
    prompts.push(result.data);
  }
  return { ok: true, prompts };
}

/** Extract the main text body from a JSON prompt, regardless of shape. */
function extractBody(p: JsonPrompt): string {
  if (p.content) return p.content;
  if (p.prompt) return p.prompt;
  if (p.messages?.length) {
    return p.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");
  }
  if (p.description) return p.description;
  return "";
}

/**
 * Format a JSON prompt as a human-readable string targeted at a specific LLM/tool.
 */
export function formatJsonPrompt(p: JsonPrompt, target: PromptTarget = "generic"): string {
  const body = extractBody(p);

  if (target === "midjourney") {
    // Flatten to single line + --flags
    const flags: string[] = [];
    if (p.version) flags.push(`--v ${p.version}`);
    if (p.aspect_ratio) flags.push(`--ar ${p.aspect_ratio}`);
    if (p.stylize !== undefined) flags.push(`--s ${p.stylize}`);
    if (p.chaos !== undefined) flags.push(`--c ${p.chaos}`);
    if (p.quality !== undefined) flags.push(`--q ${p.quality}`);
    if (p.seed !== undefined) flags.push(`--seed ${p.seed}`);
    const single = body.replace(/\s+/g, " ").trim();
    return [single, flags.join(" ")].filter(Boolean).join(" ");
  }

  // Structured markdown for ChatGPT / Claude / Gemini / generic
  const lines: string[] = [];
  if (p.title) lines.push(`# ${p.title}`);
  if (p.description && p.description !== body) {
    lines.push("", `> ${p.description}`);
  }
  if (p.system || p.instructions) {
    lines.push("", "## System");
    lines.push(p.system || p.instructions || "");
  }
  if (body) {
    lines.push("", "## Prompt", body);
  }
  if (p.parameters && Object.keys(p.parameters).length) {
    lines.push("", "## Parameters");
    for (const [k, v] of Object.entries(p.parameters)) {
      lines.push(`- **${k}**: ${typeof v === "object" ? JSON.stringify(v) : v}`);
    }
  }
  if (p.tags?.length) {
    lines.push("", `**Tags:** ${p.tags.join(", ")}`);
  }
  if (p.category) lines.push(`**Category:** ${p.category}`);
  if (p.target_model) lines.push(`**Target Model:** ${p.target_model}`);

  return lines.join("\n").trim();
}

/** Pretty-print JSON with 2-space indent. */
export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export const SAMPLE_JSON_PROMPT = `{
  "title": "Cinematic Portrait",
  "description": "A dramatic studio portrait with rim lighting.",
  "content": "Close-up portrait of a confident woman, dramatic rim light, shallow depth of field, 85mm lens, cinematic color grade.",
  "category": "photography",
  "tags": ["portrait", "cinematic", "studio"],
  "target_model": "midjourney",
  "aspect_ratio": "16:9",
  "version": "6",
  "stylize": 250
}`;

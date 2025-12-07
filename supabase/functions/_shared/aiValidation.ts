import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Security constants
const MAX_PROMPT_LENGTH = 10000;
const MAX_STYLE_PREFERENCE_LENGTH = 200;
const MAX_STYLE_PREFERENCES_COUNT = 10;

// Suspicious patterns that could indicate injection attempts
const SUSPICIOUS_PATTERNS = [
  /\b(eval|exec|system|shell|cmd|powershell)\s*\(/i,
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,  // onclick=, onerror=, etc.
  /\{\{.*\}\}/,  // Template injection
  /\$\{.*\}/,    // Template literal injection
];

// Content sanitization function
function containsSuspiciousContent(text: string): boolean {
  return SUSPICIOUS_PATTERNS.some(pattern => pattern.test(text));
}

// Custom refinement for safe content
const safeTextContent = z.string().refine(
  (val) => !containsSuspiciousContent(val),
  { message: "Content contains potentially unsafe patterns" }
);

// Generate Metadata Schema
export const GenerateMetadataSchema = z.object({
  prompt_text: z.string()
    .min(1, "Prompt text is required")
    .max(MAX_PROMPT_LENGTH, `Prompt text must be less than ${MAX_PROMPT_LENGTH} characters`)
    .refine((val) => !containsSuspiciousContent(val), {
      message: "Content contains potentially unsafe patterns"
    })
});

// Enhance Prompt Schema
export const EnhancePromptSchema = z.object({
  prompt_description: z.string()
    .min(1, "Prompt description is required")
    .max(MAX_PROMPT_LENGTH, `Prompt description must be less than ${MAX_PROMPT_LENGTH} characters`)
    .refine((val) => !containsSuspiciousContent(val), {
      message: "Content contains potentially unsafe patterns"
    }),
  model_type: z.enum(["image", "video"]).default("image"),
  style_preferences: z.array(
    z.string()
      .max(MAX_STYLE_PREFERENCE_LENGTH, `Style preference must be less than ${MAX_STYLE_PREFERENCE_LENGTH} characters`)
      .refine((val) => !containsSuspiciousContent(val), {
        message: "Style preference contains potentially unsafe patterns"
      })
  )
    .max(MAX_STYLE_PREFERENCES_COUNT, `Maximum ${MAX_STYLE_PREFERENCES_COUNT} style preferences allowed`)
    .default([])
});

// Suggest Prompt Schema (no user input except auth, but validate response expectations)
export const SuggestPromptSchema = z.object({
  category: z.string()
    .max(100, "Category must be less than 100 characters")
    .optional(),
  style: z.string()
    .max(MAX_STYLE_PREFERENCE_LENGTH, "Style must be less than 200 characters")
    .optional()
}).optional();

// Type exports
export type GenerateMetadataInput = z.infer<typeof GenerateMetadataSchema>;
export type EnhancePromptInput = z.infer<typeof EnhancePromptSchema>;
export type SuggestPromptInput = z.infer<typeof SuggestPromptSchema>;

// Helper function to validate and return typed data
export function validateAIInput<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map(e => `${e.path.join('.') || 'input'}: ${e.message}`)
        .join('; ');
      return { success: false, error: `Validation failed: ${errorMessages}` };
    }
    return { success: false, error: 'Invalid input data' };
  }
}

// Export constants for use in edge functions
export const AI_VALIDATION_CONSTANTS = {
  MAX_PROMPT_LENGTH,
  MAX_STYLE_PREFERENCE_LENGTH,
  MAX_STYLE_PREFERENCES_COUNT,
};

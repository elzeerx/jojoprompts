import { Platform } from '@/types/platform';
import { PromptFormData } from '@/types/prompt-form';

export interface FormattedPrompt {
  title: string;
  fullPrompt: string;
  platformSpecific: string;
  metadata: Record<string, any>;
}

/**
 * Format prompt data based on platform specifications
 */
export function formatPromptForPlatform(
  data: PromptFormData,
  platform: Platform
): FormattedPrompt {
  const { title, prompt_text, platform_fields } = data;

  // Base prompt
  let formattedPrompt = prompt_text;

  // Platform-specific formatting
  switch (platform.slug) {
    case 'chatgpt':
    case 'claude':
    case 'gemini':
      // Text-to-text: Add system message if provided
      if (platform_fields.system_message) {
        formattedPrompt = `System: ${platform_fields.system_message}\n\nUser: ${prompt_text}`;
      }
      // Add temperature and other parameters to metadata
      if (platform_fields.temperature !== undefined) {
        formattedPrompt += `\n\n[Temperature: ${platform_fields.temperature}]`;
      }
      if (platform_fields.max_tokens !== undefined) {
        formattedPrompt += `\n[Max Tokens: ${platform_fields.max_tokens}]`;
      }
      break;

    case 'midjourney':
    case 'dalle':
    case 'stable-diffusion':
      // Text-to-image: Append parameters
      const imageParams: string[] = [];
      if (platform_fields.version) imageParams.push(`--v ${platform_fields.version}`);
      if (platform_fields.aspect_ratio) imageParams.push(`--ar ${platform_fields.aspect_ratio}`);
      if (platform_fields.stylize) imageParams.push(`--s ${platform_fields.stylize}`);
      if (platform_fields.chaos) imageParams.push(`--c ${platform_fields.chaos}`);
      if (platform_fields.quality) imageParams.push(`--q ${platform_fields.quality}`);
      if (platform_fields.style) imageParams.push(`--style ${platform_fields.style}`);
      if (platform_fields.seed) imageParams.push(`--seed ${platform_fields.seed}`);
      if (platform_fields.additional_parameters) imageParams.push(platform_fields.additional_parameters);
      
      if (imageParams.length > 0) {
        formattedPrompt = `${prompt_text} ${imageParams.join(' ')}`;
      }
      break;

    case 'n8n':
    case 'zapier':
    case 'make':
      // Workflow: Format as description
      formattedPrompt = `Workflow: ${title}\n\nDescription: ${prompt_text}`;
      if (platform_fields.workflow_json) {
        formattedPrompt += `\n\nConfiguration:\n${platform_fields.workflow_json}`;
      }
      if (platform_fields.triggers) {
        formattedPrompt += `\n\nTriggers: ${platform_fields.triggers}`;
      }
      if (platform_fields.actions) {
        formattedPrompt += `\nActions: ${platform_fields.actions}`;
      }
      break;

    default:
      // Keep as-is for other platforms
      break;
  }

  return {
    title,
    fullPrompt: formattedPrompt,
    platformSpecific: JSON.stringify(platform_fields, null, 2),
    metadata: {
      platform: platform.name,
      category: platform.category,
      fields: platform_fields
    }
  };
}

/**
 * Estimate token count for a given text
 * Rough estimation: ~4 characters per token (OpenAI standard)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get detailed prompt length statistics
 */
export function getPromptLength(text: string): {
  characters: number;
  words: number;
  lines: number;
  estimatedTokens: number;
} {
  const trimmedText = text.trim();
  
  return {
    characters: trimmedText.length,
    words: trimmedText.split(/\s+/).filter(w => w.length > 0).length,
    lines: trimmedText.split('\n').length,
    estimatedTokens: estimateTokenCount(trimmedText)
  };
}

/**
 * Validate if a prompt is complete and ready for submission
 */
export function validatePromptCompletion(data: PromptFormData): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  if (!data.title || data.title.trim().length === 0) {
    missingFields.push('Title');
  }

  if (!data.prompt_text || data.prompt_text.trim().length === 0) {
    missingFields.push('Prompt text');
  }

  if (!data.platform_id) {
    missingFields.push('Platform');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Prompt Form Types
 * 
 * Minimal type definitions for prompt form data structure.
 * Used by formatters, transformers, and services.
 */

import { Platform } from './platform';

/**
 * Base fields that apply to ALL prompts
 */
export interface BasePromptFields {
  title: string;
  title_ar?: string;
  prompt_text: string;
  prompt_text_ar?: string;
  category_id?: string;
  thumbnail?: File | null;
  thumbnail_url?: string;
}

/**
 * Complete prompt form data structure
 */
export interface PromptFormData extends BasePromptFields {
  platform_id: string;
  platform_fields: Record<string, any>;
}

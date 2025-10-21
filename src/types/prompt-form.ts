/**
 * Prompt Form Types
 * 
 * Type definitions for the unified prompt creation/editing system.
 * Includes base fields common to all prompts and platform-specific field types.
 */

import { Platform, PlatformField } from './platform';

/**
 * Base fields that apply to ALL prompts regardless of platform
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
 * Platform-specific dynamic fields
 * Structure depends on the selected platform's field configuration
 */
export interface PlatformPromptFields {
  [key: string]: any; // Dynamic fields based on platform
}

/**
 * Complete prompt form data structure
 * Combines base fields with platform-specific fields
 */
export interface PromptFormData extends BasePromptFields {
  platform_id: string;
  platform_fields: PlatformPromptFields;
}

/**
 * Multi-step form wizard step definition
 */
export interface PromptFormStep {
  id: string;
  title: string;
  description?: string;
  isComplete: boolean;
}

/**
 * Form operation mode
 */
export type PromptFormMode = 'create' | 'edit';

/**
 * Form validation state for base fields
 */
export interface BasePromptFieldsValidation {
  title?: string;
  title_ar?: string;
  prompt_text?: string;
  prompt_text_ar?: string;
  category_id?: string;
  thumbnail?: string;
}

/**
 * Complete form state including validation
 */
export interface PromptFormState {
  data: PromptFormData;
  validation: BasePromptFieldsValidation;
  currentStep: number;
  isSubmitting: boolean;
  isDirty: boolean;
}

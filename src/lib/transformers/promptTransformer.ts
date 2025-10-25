import { PromptFormData } from '@/types/prompt-form';

/**
 * Transform database prompt to form data
 */
export function transformPromptToFormData(prompt: any): PromptFormData {
  return {
    title: prompt.title || '',
    title_ar: prompt.title_ar || '',
    prompt_text: prompt.prompt_text || '',
    prompt_text_ar: prompt.prompt_text_ar || '',
    category_id: (prompt.metadata as any)?.category || '',
    thumbnail: null, // File will be handled separately
    thumbnail_url: prompt.image_path || '',
    platform_id: prompt.platform_id,
    platform_fields: (prompt.platform_fields as any) || {}
  };
}

/**
 * Transform form data to database format
 */
export function transformFormDataToPrompt(formData: PromptFormData, userId: string) {
  return {
    title: formData.title,
    title_ar: formData.title_ar || null,
    prompt_text: formData.prompt_text,
    prompt_text_ar: formData.prompt_text_ar || null,
    platform_id: formData.platform_id,
    platform_fields: formData.platform_fields,
    metadata: {
      category_id: formData.category_id || null
    },
    user_id: userId
  };
}

/**
 * Merge form data with defaults
 */
export function mergeWithDefaults(
  formData: Partial<PromptFormData>,
  defaults: Partial<PromptFormData>
): PromptFormData {
  return {
    title: formData.title ?? defaults.title ?? '',
    title_ar: formData.title_ar ?? defaults.title_ar ?? '',
    prompt_text: formData.prompt_text ?? defaults.prompt_text ?? '',
    prompt_text_ar: formData.prompt_text_ar ?? defaults.prompt_text_ar ?? '',
    category_id: formData.category_id ?? defaults.category_id ?? '',
    thumbnail: formData.thumbnail ?? defaults.thumbnail ?? null,
    thumbnail_url: formData.thumbnail_url ?? defaults.thumbnail_url ?? '',
    platform_id: formData.platform_id ?? defaults.platform_id ?? '',
    platform_fields: {
      ...defaults.platform_fields,
      ...formData.platform_fields
    }
  };
}

import { PromptFormData } from '@/types/prompt-form';
import { PlatformField } from '@/types/platform';
import { validateForm } from '@/lib/validation/validateForm';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate base fields
 */
export function validateBaseFields(data: PromptFormData): ValidationResult {
  const errors: ValidationError[] = [];

  // Title validation
  if (!data.title || data.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Title is required' });
  } else if (data.title.length > 100) {
    errors.push({ field: 'title', message: 'Title must be 100 characters or less' });
  }

  // Prompt text validation
  if (!data.prompt_text || data.prompt_text.trim().length === 0) {
    errors.push({ field: 'prompt_text', message: 'Prompt text is required' });
  } else if (data.prompt_text.length > 5000) {
    errors.push({ field: 'prompt_text', message: 'Prompt text must be 5000 characters or less' });
  }

  // Platform validation
  if (!data.platform_id) {
    errors.push({ field: 'platform_id', message: 'Platform must be selected' });
  }

  // Thumbnail validation (if provided)
  if (data.thumbnail) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (data.thumbnail.size > maxSize) {
      errors.push({ field: 'thumbnail', message: 'Thumbnail must be less than 5MB' });
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(data.thumbnail.type)) {
      errors.push({ field: 'thumbnail', message: 'Thumbnail must be PNG, JPG, or WEBP' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate platform-specific fields
 */
export function validatePlatformFields(
  platformFields: Record<string, any>,
  fieldDefinitions: PlatformField[]
): ValidationResult {
  const validationResults = validateForm(platformFields, fieldDefinitions);
  
  const errors: ValidationError[] = [];
  Object.entries(validationResults).forEach(([fieldKey, result]) => {
    if (!result.isValid) {
      result.errors.forEach(errorMsg => {
        errors.push({ field: fieldKey, message: errorMsg });
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate complete prompt data
 */
export function validatePromptData(
  data: PromptFormData,
  platformFields?: PlatformField[]
): ValidationResult {
  const baseValidation = validateBaseFields(data);
  
  if (!baseValidation.isValid) {
    return baseValidation;
  }

  if (platformFields && platformFields.length > 0) {
    const platformValidation = validatePlatformFields(data.platform_fields, platformFields);
    if (!platformValidation.isValid) {
      return platformValidation;
    }
  }

  return { isValid: true, errors: [] };
}

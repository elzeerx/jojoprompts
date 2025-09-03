import { useState, useEffect } from 'react';

// Prompt type constants for validation and referencing
export const MODEL_PROMPT_TYPES = {
  CHATGPT: {
    TEXT: 'chatgpt-text',
    IMAGE: 'chatgpt-image'
  },
  CLAUDE: {
    TEXT: 'claude-text',
    CODE: 'claude-code'
  },
  MIDJOURNEY: {
    FULL_PROMPT: 'midjourney-full',
    STYLE_REFERENCE: 'midjourney-sref'
  },
  VIDEO: {
    FULL_PROMPT: 'video-full',
    JSON_PROMPT: 'video-json'
  },
  WORKFLOW: {
    N8N: 'workflow-n8n'
  }
} as const;

// Legacy prompt types for backward compatibility
export const PROMPT_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  WORKFLOW: 'workflow',
  SOUND: 'sound'
} as const;

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  qualityScore: number;
  suggestions: string[];
}

interface ValidationOptions {
  checkQuality?: boolean;
}

export function usePromptValidation(formData: any, options: ValidationOptions = {}): ValidationResult {
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: false,
    errors: {},
    qualityScore: 0,
    suggestions: []
  });

  useEffect(() => {
    const validatePrompt = () => {
      const errors: Record<string, string> = {};
      let qualityScore = 0;
      const suggestions: string[] = [];

      // Basic validation
      if (!formData?.title?.trim()) {
        errors.title = 'Title is required';
      } else {
        qualityScore += 20;
      }

      if (!formData?.prompt_text?.trim()) {
        errors.prompt_text = 'Prompt text is required';
      } else {
        qualityScore += 30;
        if (formData.prompt_text.length > 50) {
          qualityScore += 20;
        }
      }

      if (!formData?.prompt_type) {
        errors.prompt_type = 'Prompt type is required';
      } else {
        qualityScore += 10;
      }

      // Quality suggestions
      if (options.checkQuality && formData?.prompt_text) {
        if (formData.prompt_text.length < 30) {
          suggestions.push('Consider adding more detail to your prompt');
        }
        if (!formData.metadata?.tags?.length) {
          suggestions.push('Add tags to help categorize your prompt');
        }
        if (!formData.metadata?.category) {
          suggestions.push('Select a category for better organization');
        }
      }

      const isValid = Object.keys(errors).length === 0;
      if (isValid) qualityScore += 20;

      setValidationResult({
        isValid,
        errors,
        qualityScore: Math.min(100, qualityScore),
        suggestions
      });
    };

    validatePrompt();
  }, [formData, options.checkQuality]);

  return validationResult;
}
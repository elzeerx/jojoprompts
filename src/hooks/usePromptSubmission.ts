import { useState, useCallback } from 'react';
import { PromptFormData } from '@/types/prompt-form';
import { PlatformField } from '@/types/platform';
import { createPrompt, updatePrompt, CreatePromptParams, UpdatePromptParams } from '@/services/promptService';
import { validatePromptData, ValidationError } from '@/services/validationService';
import { toast } from 'sonner';

export interface UsePromptSubmissionOptions {
  mode?: 'create' | 'edit';
  existingPromptId?: string;
  existingThumbnailUrl?: string;
  platformFields?: PlatformField[];
  onSuccess?: (promptId: string) => void;
  onError?: (error: Error) => void;
}

export function usePromptSubmission({
  mode = 'create',
  existingPromptId,
  existingThumbnailUrl,
  platformFields,
  onSuccess,
  onError
}: UsePromptSubmissionOptions = {}) {
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const submit = useCallback(async (data: PromptFormData) => {
    // Reset validation errors
    setValidationErrors([]);

    // Validate data
    const validation = validatePromptData(data, platformFields);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      toast.error('Please fix the errors before submitting');
      return { success: false, errors: validation.errors };
    }

    // Start submission
    setIsSubmitting(true);

    try {
      let promptId: string;

      if (mode === 'edit' && existingPromptId) {
        // Update existing prompt
        const updateParams: UpdatePromptParams = {
          id: existingPromptId,
          title: data.title,
          title_ar: data.title_ar,
          prompt_text: data.prompt_text,
          prompt_text_ar: data.prompt_text_ar,
          category_id: data.category_id,
          platform_id: data.platform_id,
          platform_fields: data.platform_fields,
          thumbnail: data.thumbnail,
          existing_thumbnail_url: existingThumbnailUrl
        };

        const result = await updatePrompt(updateParams);
        promptId = result.id;
        toast.success('Prompt updated successfully!');
      } else {
        // Create new prompt
        const createParams: CreatePromptParams = {
          title: data.title,
          title_ar: data.title_ar,
          prompt_text: data.prompt_text,
          prompt_text_ar: data.prompt_text_ar,
          category_id: data.category_id,
          platform_id: data.platform_id,
          platform_fields: data.platform_fields,
          thumbnail: data.thumbnail
        };

        const result = await createPrompt(createParams);
        promptId = result.id;
        toast.success('Prompt created successfully!');
      }

      // Call success callback
      if (onSuccess) {
        onSuccess(promptId);
      }

      return { success: true, promptId };
    } catch (error) {
      console.error('Submission error:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to save prompt. Please try again.';
      
      toast.error(errorMessage);
      
      if (onError) {
        onError(error as Error);
      }

      return { success: false, error: errorMessage };
    } finally {
      setIsSubmitting(false);
    }
  }, [mode, existingPromptId, existingThumbnailUrl, platformFields, onSuccess, onError]);

  return {
    submit,
    isSubmitting,
    validationErrors,
    clearValidationErrors: () => setValidationErrors([])
  };
}

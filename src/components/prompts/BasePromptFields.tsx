import React from 'react';
import { TextField, TextareaField } from './fields';
import { CategorySelector, Category } from './CategorySelector';
import { ThumbnailUpload } from './ThumbnailUpload';
import { PlatformField } from '@/types/platform';
import { BasePromptFields } from '@/types/prompt-form';
import { FieldSection } from './FieldSection';

export interface BasePromptFieldsProps {
  values: BasePromptFields;
  onChange: (field: keyof BasePromptFields, value: any) => void;
  errors?: Partial<Record<keyof BasePromptFields, string>>;
  categories: Category[];
  onCreateCategory?: (name: string) => Promise<void>;
  showBilingualSupport?: boolean;
  disabled?: boolean;
  className?: string;
}

export function BasePromptFieldsSection({
  values,
  onChange,
  errors = {},
  categories,
  onCreateCategory,
  showBilingualSupport = false,
  disabled = false,
  className
}: BasePromptFieldsProps) {
  
  // Create PlatformField objects for TextField and TextareaField
  const titleField: PlatformField = {
    id: 'base-title',
    platform_id: 'base',
    field_key: 'title',
    field_type: 'text',
    label: 'Prompt Title',
    placeholder: 'Enter a descriptive title for your prompt...',
    is_required: true,
    validation_rules: { maxLength: 100 },
    help_text: 'A clear, descriptive title for your prompt (max 100 characters)',
    display_order: 1,
    created_at: '',
    updated_at: ''
  };

  const promptTextField: PlatformField = {
    id: 'base-prompt-text',
    platform_id: 'base',
    field_key: 'prompt_text',
    field_type: 'textarea',
    label: 'Prompt Text',
    placeholder: 'Enter your prompt text here...',
    is_required: true,
    validation_rules: { maxLength: 5000 },
    help_text: 'The main content of your prompt (max 5000 characters)',
    display_order: 2,
    created_at: '',
    updated_at: ''
  };

  return (
    <FieldSection
      title="Basic Information"
      description="Essential details that apply to all prompts"
      className={className}
    >
      <div className="space-y-6">
        {/* Title */}
        <TextField
          field={titleField}
          value={values.title}
          onChange={(value) => onChange('title', value)}
          error={errors.title}
          disabled={disabled}
        />

        {/* Prompt Text */}
        <TextareaField
          field={promptTextField}
          value={values.prompt_text}
          onChange={(value) => onChange('prompt_text', value)}
          error={errors.prompt_text}
          disabled={disabled}
        />

        {/* Bilingual Support (Optional) */}
        {showBilingualSupport && (
          <>
            <TextField
              field={{
                ...titleField,
                field_key: 'title_ar',
                label: 'Prompt Title (Arabic)',
                placeholder: 'أدخل عنوان الموجه...',
                is_required: false,
                help_text: 'Optional Arabic translation of the title'
              }}
              value={values.title_ar || ''}
              onChange={(value) => onChange('title_ar', value)}
              error={errors.title_ar}
              disabled={disabled}
            />

            <TextareaField
              field={{
                ...promptTextField,
                field_key: 'prompt_text_ar',
                label: 'Prompt Text (Arabic)',
                placeholder: 'أدخل نص الموجه هنا...',
                is_required: false,
                help_text: 'Optional Arabic translation of the prompt'
              }}
              value={values.prompt_text_ar || ''}
              onChange={(value) => onChange('prompt_text_ar', value)}
              error={errors.prompt_text_ar}
              disabled={disabled}
            />
          </>
        )}

        {/* Category */}
        <CategorySelector
          value={values.category_id}
          onChange={(value) => onChange('category_id', value)}
          categories={categories}
          onCreateCategory={onCreateCategory}
          error={errors.category_id}
          disabled={disabled}
        />

        {/* Thumbnail Upload */}
        <ThumbnailUpload
          value={values.thumbnail}
          existingUrl={values.thumbnail_url}
          onChange={(file) => onChange('thumbnail', file)}
          error={errors.thumbnail}
          disabled={disabled}
        />
      </div>
    </FieldSection>
  );
}

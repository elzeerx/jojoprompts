import { useState, useEffect } from 'react';

// Common validation patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  USERNAME: /^[a-zA-Z0-9_-]{3,20}$/,
  PHONE: /^\+?[\d\s\-\(\)]{10,}$/,
  URL: /^https?:\/\/.+/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
} as const;

// Common validation messages
export const VALIDATION_MESSAGES = {
  REQUIRED: "This field is required",
  EMAIL: "Please enter a valid email address",
  PASSWORD: "Password must be at least 8 characters with uppercase, lowercase, and number",
  USERNAME: "Username must be 3-20 characters (letters, numbers, underscore, hyphen)",
  PHONE: "Please enter a valid phone number",
  URL: "Please enter a valid URL",
  MIN_LENGTH: (min: number) => `Must be at least ${min} characters`,
  MAX_LENGTH: (max: number) => `Must be no more than ${max} characters`,
  MIN_VALUE: (min: number) => `Must be at least ${min}`,
  MAX_VALUE: (max: number) => `Must be no more than ${max}`,
  MATCHES_PATTERN: (pattern: string) => `Must match the pattern: ${pattern}`,
  UNIQUE: "This value already exists",
  INVALID_FORMAT: "Invalid format"
} as const;

// Prompt-specific validation patterns
export const PROMPT_VALIDATION_PATTERNS = {
  ...VALIDATION_PATTERNS,
  PROMPT_TEXT: /^[\s\S]+$/,
  MIDJOURNEY_STYLE_REF: /^--sref\s+[a-zA-Z0-9]{8,}$/,
  JSON_PROMPT: /^\{[\s\S]*\}$/,
  WORKFLOW_STEP: /^[\s\S]{3,}$/,
  TAG_FORMAT: /^[a-zA-Z0-9\s\-_]{1,30}$/,
  CATEGORY_FORMAT: /^[a-zA-Z0-9\s\-_]{1,50}$/
} as const;

// Prompt validation error messages
export const PROMPT_VALIDATION_MESSAGES = {
  ...VALIDATION_MESSAGES,
  TITLE_REQUIRED: "Prompt title is required",
  TITLE_TOO_SHORT: "Title must be at least 3 characters",
  TITLE_TOO_LONG: "Title must be no more than 100 characters",
  PROMPT_TEXT_REQUIRED: "Prompt text is required",
  PROMPT_TEXT_TOO_SHORT: "Prompt text must be at least 10 characters",
  PROMPT_TEXT_TOO_LONG: "Prompt text must be no more than 5000 characters",
  CATEGORY_REQUIRED: "Category is required",
  TARGET_MODEL_REQUIRED: "Target model is required for text prompts",
  WORKFLOW_STEPS_REQUIRED: "At least one workflow step is required",
  WORKFLOW_STEP_TOO_SHORT: "Workflow step must be at least 3 characters",
  WORKFLOW_FILES_REQUIRED: "Workflow files are required for workflow prompts",
  MEDIA_FILES_REQUIRED: "Media files are required for image/video prompts",
  INVALID_MIDJOURNEY_STYLE: "Invalid Midjourney style reference format. Use: --sref XXXXXXXX",
  INVALID_JSON_FORMAT: "Invalid JSON format for video prompt",
  TOO_MANY_TAGS: "Maximum 10 tags allowed",
  TAG_TOO_LONG: "Tag must be no more than 30 characters",
  DUPLICATE_TAGS: "Duplicate tags are not allowed",
  INVALID_TAG_FORMAT: "Tags can only contain letters, numbers, spaces, hyphens, and underscores"
} as const;

// Prompt type definitions
export const PROMPT_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  WORKFLOW: 'workflow',
  VIDEO: 'video',
  SOUND: 'sound'
} as const;

export type PromptType = typeof PROMPT_TYPES[keyof typeof PROMPT_TYPES];

// Model-specific prompt types
export const MODEL_PROMPT_TYPES = {
  CHATGPT: {
    TEXT: 'chatgpt-text',
    IMAGE: 'chatgpt-image',
    CODE: 'chatgpt-code'
  },
  MIDJOURNEY: {
    FULL_PROMPT: 'midjourney-full',
    STYLE_REFERENCE: 'midjourney-style-ref'
  },
  VIDEO: {
    FULL_PROMPT: 'video-full',
    JSON_PROMPT: 'video-json'
  },
  WORKFLOW: {
    N8N: 'workflow-n8n',
    GENERAL: 'workflow-general'
  }
} as const;

// Prompt validation interface
export interface PromptValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  qualityScore: number;
  suggestions: string[];
}

// Enhanced prompt validation function
export function validatePrompt(
  formData: {
    title: string;
    promptText: string;
    promptType: string;
    metadata: any;
  },
  options: {
    strict?: boolean;
    checkQuality?: boolean;
  } = {}
): PromptValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  const suggestions: string[] = [];
  let qualityScore = 100;

  // Basic field validation
  if (!formData.title?.trim()) {
    errors.title = PROMPT_VALIDATION_MESSAGES.TITLE_REQUIRED;
    qualityScore -= 20;
  } else if (formData.title.length < 3) {
    errors.title = PROMPT_VALIDATION_MESSAGES.TITLE_TOO_SHORT;
    qualityScore -= 10;
  } else if (formData.title.length > 100) {
    errors.title = PROMPT_VALIDATION_MESSAGES.TITLE_TOO_LONG;
    qualityScore -= 5;
  }

  if (!formData.promptText?.trim()) {
    errors.promptText = PROMPT_VALIDATION_MESSAGES.PROMPT_TEXT_REQUIRED;
    qualityScore -= 30;
  } else if (formData.promptText && formData.promptText.length < 10) {
    errors.promptText = PROMPT_VALIDATION_MESSAGES.PROMPT_TEXT_TOO_SHORT;
    qualityScore -= 15;
  } else if (formData.promptText && formData.promptText.length > 5000) {
    errors.promptText = PROMPT_VALIDATION_MESSAGES.PROMPT_TEXT_TOO_LONG;
    qualityScore -= 10;
  }

  // Category validation
  if (!formData.metadata?.category) {
    errors.category = PROMPT_VALIDATION_MESSAGES.CATEGORY_REQUIRED;
    qualityScore -= 15;
  }

  // Type-specific validation
  switch (formData.promptType) {
    case PROMPT_TYPES.TEXT:
      validateTextPrompt(formData, errors, warnings, qualityScore, suggestions);
      break;
    case PROMPT_TYPES.IMAGE:
      validateImagePrompt(formData, errors, warnings, qualityScore, suggestions);
      break;
    case PROMPT_TYPES.WORKFLOW:
      validateWorkflowPrompt(formData, errors, warnings, qualityScore, suggestions);
      break;
    case PROMPT_TYPES.VIDEO:
      validateVideoPrompt(formData, errors, warnings, qualityScore, suggestions);
      break;
    case PROMPT_TYPES.SOUND:
      validateSoundPrompt(formData, errors, warnings, qualityScore, suggestions);
      break;
  }

  // Metadata validation
  validatePromptMetadata(formData.metadata, errors, warnings, qualityScore, suggestions);

  // Quality assessment
  if (options.checkQuality) {
    const qualityAssessment = assessPromptQuality(formData);
    qualityScore = Math.max(0, qualityScore + qualityAssessment.scoreAdjustment);
    suggestions.push(...qualityAssessment.suggestions);
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
    qualityScore: Math.max(0, qualityScore),
    suggestions
  };
}

// Text prompt validation
function validateTextPrompt(
  formData: any,
  errors: Record<string, string>,
  warnings: Record<string, string>,
  qualityScore: number,
  suggestions: string[]
) {
  if (!formData.metadata?.target_model) {
    errors.targetModel = PROMPT_VALIDATION_MESSAGES.TARGET_MODEL_REQUIRED;
    qualityScore -= 10;
  }

  // Check for common text prompt issues
  if (formData.promptText && formData.promptText.length < 50) {
    warnings.promptText = "Consider adding more detail to your prompt for better results";
    qualityScore -= 5;
  }

  if (!formData.metadata?.tags || formData.metadata.tags.length === 0) {
    warnings.tags = "Adding tags helps with discoverability";
    qualityScore -= 5;
  }
}

// Image prompt validation
function validateImagePrompt(
  formData: any,
  errors: Record<string, string>,
  warnings: Record<string, string>,
  qualityScore: number,
  suggestions: string[]
) {
  // Check for Midjourney style reference format
  if (formData.metadata?.category?.toLowerCase().includes('midjourney') && formData.promptText) {
    const hasStyleRef = PROMPT_VALIDATION_PATTERNS.MIDJOURNEY_STYLE_REF.test(formData.promptText);
    if (!hasStyleRef && formData.promptText.includes('--sref')) {
      errors.promptText = PROMPT_VALIDATION_MESSAGES.INVALID_MIDJOURNEY_STYLE;
      qualityScore -= 10;
    }
  }

  // Check for media files
  if (!formData.metadata?.media_files || formData.metadata.media_files.length === 0) {
    warnings.mediaFiles = "Adding example images helps users understand the expected output";
    qualityScore -= 5;
  }
}

// Workflow prompt validation
function validateWorkflowPrompt(
  formData: any,
  errors: Record<string, string>,
  warnings: Record<string, string>,
  qualityScore: number,
  suggestions: string[]
) {
  if (!formData.metadata?.workflow_steps || formData.metadata.workflow_steps.length === 0) {
    errors.workflowSteps = PROMPT_VALIDATION_MESSAGES.WORKFLOW_STEPS_REQUIRED;
    qualityScore -= 20;
  } else {
    // Validate each workflow step
    formData.metadata.workflow_steps.forEach((step: any, index: number) => {
      if (!step.name?.trim() || step.name.length < 3) {
        errors[`workflowStep${index}`] = PROMPT_VALIDATION_MESSAGES.WORKFLOW_STEP_TOO_SHORT;
        qualityScore -= 5;
      }
    });
  }

  if (!formData.metadata?.workflow_files || formData.metadata.workflow_files.length === 0) {
    errors.workflowFiles = PROMPT_VALIDATION_MESSAGES.WORKFLOW_FILES_REQUIRED;
    qualityScore -= 15;
  }
}

// Video prompt validation
function validateVideoPrompt(
  formData: any,
  errors: Record<string, string>,
  warnings: Record<string, string>,
  qualityScore: number,
  suggestions: string[]
) {
  // Check if it's a JSON prompt
  if (formData.promptText && formData.promptText.trim().startsWith('{')) {
    try {
      JSON.parse(formData.promptText);
    } catch {
      errors.promptText = PROMPT_VALIDATION_MESSAGES.INVALID_JSON_FORMAT;
      qualityScore -= 15;
    }
  }

  // Check for media files
  if (!formData.metadata?.media_files || formData.metadata.media_files.length === 0) {
    warnings.mediaFiles = "Adding example videos helps users understand the expected output";
    qualityScore -= 5;
  }
}

// Sound prompt validation
function validateSoundPrompt(
  formData: any,
  errors: Record<string, string>,
  warnings: Record<string, string>,
  qualityScore: number,
  suggestions: string[]
) {
  // Check for media files
  if (!formData.metadata?.media_files || formData.metadata.media_files.length === 0) {
    warnings.mediaFiles = "Adding example audio files helps users understand the expected output";
    qualityScore -= 5;
  }
}

// Metadata validation
function validatePromptMetadata(
  metadata: any,
  errors: Record<string, string>,
  warnings: Record<string, string>,
  qualityScore: number,
  suggestions: string[]
) {
  // Tags validation
  if (metadata?.tags) {
    if (metadata.tags.length > 10) {
      errors.tags = PROMPT_VALIDATION_MESSAGES.TOO_MANY_TAGS;
      qualityScore -= 5;
    }

    // Check for duplicates
    const uniqueTags = new Set(metadata.tags);
    if (uniqueTags.size !== metadata.tags.length) {
      errors.tags = PROMPT_VALIDATION_MESSAGES.DUPLICATE_TAGS;
      qualityScore -= 5;
    }

    // Validate tag format
    metadata.tags.forEach((tag: string) => {
      if (!PROMPT_VALIDATION_PATTERNS.TAG_FORMAT.test(tag)) {
        errors.tags = PROMPT_VALIDATION_MESSAGES.INVALID_TAG_FORMAT;
        qualityScore -= 5;
      }
      if (tag.length > 30) {
        errors.tags = PROMPT_VALIDATION_MESSAGES.TAG_TOO_LONG;
        qualityScore -= 5;
      }
    });
  }
}

// Quality assessment
function assessPromptQuality(formData: any): { scoreAdjustment: number; suggestions: string[] } {
  let scoreAdjustment = 0;
  const suggestions: string[] = [];

  // Content quality checks
  if (formData.promptText && formData.promptText.length < 100) {
    scoreAdjustment -= 10;
    suggestions.push("Consider adding more detail to your prompt");
  }

  if (!formData.metadata?.use_case) {
    scoreAdjustment -= 5;
    suggestions.push("Adding a use case helps users understand when to use this prompt");
  }

  if (!formData.metadata?.style) {
    scoreAdjustment -= 5;
    suggestions.push("Adding a style helps categorize your prompt");
  }

  // Positive adjustments for good practices
  if (formData.metadata?.tags && formData.metadata.tags.length >= 3) {
    scoreAdjustment += 5;
  }

  if (formData.metadata?.media_files && formData.metadata.media_files.length > 0) {
    scoreAdjustment += 10;
  }

  return { scoreAdjustment, suggestions };
}

// Real-time validation hook
export function usePromptValidation(formData: any, options = {}) {
  const [validationResult, setValidationResult] = useState<PromptValidationResult>({
    isValid: false,
    errors: {},
    warnings: {},
    qualityScore: 0,
    suggestions: []
  });

  useEffect(() => {
    const result = validatePrompt(formData, options);
    setValidationResult(result);
  }, [formData, options]);

  return validationResult;
} 
import { MODEL_PROMPT_TYPES, PROMPT_TYPES } from './promptValidation';

// Model-specific prompt type definitions
export interface ModelPromptType {
  id: string;
  name: string;
  description: string;
  category: string;
  fields: PromptField[];
  validation: ValidationRules;
  examples: string[];
  tips: string[];
  icon?: string;
  color?: string;
}

export interface PromptField {
  id: string;
  name: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'boolean' | 'file' | 'json';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: any) => string | null;
  };
  help?: string;
  defaultValue?: any;
}

export interface ValidationRules {
  required: string[];
  optional: string[];
  custom?: (data: any) => Record<string, string>;
}

// ChatGPT Text Prompt
export const CHATGPT_TEXT_PROMPT: ModelPromptType = {
  id: MODEL_PROMPT_TYPES.CHATGPT.TEXT,
  name: 'ChatGPT Text Prompt',
  description: 'Create text-based prompts for ChatGPT and other language models',
  category: 'ChatGPT',
  fields: [
    {
      id: 'promptText',
      name: 'Prompt Text',
      type: 'textarea',
      required: true,
      placeholder: 'Enter your prompt here...',
      validation: {
        minLength: 10,
        maxLength: 2000,
        custom: (value) => {
          if (value.length < 50) {
            return 'Consider adding more detail for better results';
          }
          return null;
        }
      },
      help: 'Be specific and clear about what you want the AI to do'
    },
    {
      id: 'target_model',
      name: 'Target Model',
      type: 'select',
      required: true,
      options: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-4.1', label: 'GPT-4.1' },
        { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
        { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
        { value: 'o3', label: 'OpenAI o3' },
        { value: 'o4-mini', label: 'OpenAI o4-mini' }
      ],
      help: 'Select the AI model this prompt is optimized for'
    },
    {
      id: 'temperature',
      name: 'Temperature',
      type: 'number',
      required: false,
      defaultValue: 0.7,
      validation: {
        minLength: 0,
        maxLength: 2
      },
      help: 'Controls randomness (0 = focused, 2 = creative)'
    },
    {
      id: 'max_tokens',
      name: 'Max Tokens',
      type: 'number',
      required: false,
      defaultValue: 1000,
      help: 'Maximum response length'
    },
    {
      id: 'use_case',
      name: 'Use Case',
      type: 'select',
      required: false,
      options: [
        { value: 'content_creation', label: 'Content Creation' },
        { value: 'analysis', label: 'Analysis' },
        { value: 'conversation', label: 'Conversation' },
        { value: 'coding', label: 'Coding' },
        { value: 'writing', label: 'Writing' },
        { value: 'brainstorming', label: 'Brainstorming' }
      ],
      help: 'How this prompt will be used'
    }
  ],
  validation: {
    required: ['promptText', 'target_model'],
    optional: ['temperature', 'max_tokens', 'use_case']
  },
  examples: [
    'Write a professional email to schedule a meeting',
    'Explain quantum computing in simple terms',
    'Help me brainstorm ideas for a blog post about AI'
  ],
  tips: [
    'Be specific about the desired output format',
    'Include context and background information',
    'Specify the tone and style you want'
  ],
  color: '#10a37f'
};

// ChatGPT Image Prompt
export const CHATGPT_IMAGE_PROMPT: ModelPromptType = {
  id: MODEL_PROMPT_TYPES.CHATGPT.IMAGE,
  name: 'ChatGPT Image Prompt',
  description: 'Create image generation prompts for DALL-E and other image models',
  category: 'ChatGPT',
  fields: [
    {
      id: 'promptText',
      name: 'Image Description',
      type: 'textarea',
      required: true,
      placeholder: 'Describe the image you want to generate...',
      validation: {
        minLength: 10,
        maxLength: 1000
      },
      help: 'Be detailed about the visual elements, style, and composition'
    },
    {
      id: 'style',
      name: 'Art Style',
      type: 'select',
      required: false,
      options: [
        { value: 'photorealistic', label: 'Photorealistic' },
        { value: 'artistic', label: 'Artistic' },
        { value: 'cartoon', label: 'Cartoon' },
        { value: 'abstract', label: 'Abstract' },
        { value: 'vintage', label: 'Vintage' },
        { value: 'modern', label: 'Modern' }
      ],
      help: 'Choose the visual style for your image'
    },
    {
      id: 'aspect_ratio',
      name: 'Aspect Ratio',
      type: 'select',
      required: false,
      options: [
        { value: '1:1', label: 'Square (1:1)' },
        { value: '16:9', label: 'Widescreen (16:9)' },
        { value: '9:16', label: 'Portrait (9:16)' },
        { value: '4:3', label: 'Standard (4:3)' }
      ],
      help: 'Choose the image dimensions'
    },
    {
      id: 'quality',
      name: 'Quality',
      type: 'select',
      required: false,
      options: [
        { value: 'standard', label: 'Standard' },
        { value: 'hd', label: 'HD' }
      ],
      help: 'Select image quality level'
    }
  ],
  validation: {
    required: ['promptText'],
    optional: ['style', 'aspect_ratio', 'quality']
  },
  examples: [
    'A serene mountain landscape at sunset with golden light',
    'A futuristic city with flying cars and neon lights',
    'A cozy coffee shop interior with warm lighting'
  ],
  tips: [
    'Include specific details about lighting, colors, and mood',
    'Mention the composition and perspective',
    'Specify any artistic styles or influences'
  ],
  color: '#ff6b35'
};

// Midjourney Full Prompt
export const MIDJOURNEY_FULL_PROMPT: ModelPromptType = {
  id: MODEL_PROMPT_TYPES.MIDJOURNEY.FULL_PROMPT,
  name: 'Midjourney Full Prompt',
  description: 'Create comprehensive Midjourney prompts with parameters',
  category: 'Midjourney',
  fields: [
    {
      id: 'promptText',
      name: 'Main Prompt',
      type: 'textarea',
      required: true,
      placeholder: 'Describe your image in detail...',
      validation: {
        minLength: 10,
        maxLength: 2000
      },
      help: 'Describe the main subject, scene, and visual elements'
    },
    {
      id: 'parameters',
      name: 'Parameters',
      type: 'text',
      required: false,
      placeholder: '--ar 16:9 --v 6 --q 2 --s 750',
      help: 'Midjourney parameters (aspect ratio, version, quality, style)'
    },
    {
      id: 'style',
      name: 'Art Style',
      type: 'select',
      required: false,
      options: [
        { value: 'photographic', label: 'Photographic' },
        { value: 'digital_art', label: 'Digital Art' },
        { value: 'cinematic', label: 'Cinematic' },
        { value: 'anime', label: 'Anime' },
        { value: 'painting', label: 'Painting' },
        { value: 'illustration', label: 'Illustration' }
      ],
      help: 'Choose the artistic style'
    },
    {
      id: 'lighting',
      name: 'Lighting',
      type: 'select',
      required: false,
      options: [
        { value: 'natural', label: 'Natural Light' },
        { value: 'dramatic', label: 'Dramatic' },
        { value: 'studio', label: 'Studio' },
        { value: 'golden_hour', label: 'Golden Hour' },
        { value: 'night', label: 'Night' }
      ],
      help: 'Specify the lighting conditions'
    }
  ],
  validation: {
    required: ['promptText'],
    optional: ['parameters', 'style', 'lighting']
  },
  examples: [
    'A majestic dragon soaring over a medieval castle at sunset --ar 16:9 --v 6',
    'Portrait of a cyberpunk warrior with neon lights --ar 9:16 --s 750',
    'A serene Japanese garden with cherry blossoms --ar 1:1 --q 2'
  ],
  tips: [
    'Use descriptive adjectives and specific details',
    'Include Midjourney parameters for better control',
    'Mention lighting, composition, and mood'
  ],
  color: '#7a9e9f'
};

// Midjourney Style Reference
export const MIDJOURNEY_STYLE_REF_PROMPT: ModelPromptType = {
  id: MODEL_PROMPT_TYPES.MIDJOURNEY.STYLE_REFERENCE,
  name: 'Midjourney Style Reference',
  description: 'Create prompts using Midjourney style references',
  category: 'Midjourney',
  fields: [
    {
      id: 'promptText',
      name: 'Main Prompt',
      type: 'textarea',
      required: true,
      placeholder: 'Describe your image...',
      validation: {
        minLength: 10,
        maxLength: 1000
      },
      help: 'Describe what you want to create'
    },
    {
      id: 'style_reference',
      name: 'Style Reference',
      type: 'text',
      required: true,
      placeholder: '--sref XXXXXXXX',
      validation: {
        pattern: /^--sref\s+[a-zA-Z0-9]{8,}$/,
        custom: (value) => {
          if (!value.match(/^--sref\s+[a-zA-Z0-9]{8,}$/)) {
            return 'Style reference must be in format: --sref XXXXXXXX';
          }
          return null;
        }
      },
      help: 'Enter the style reference code (--sref XXXXXXXX)'
    },
    {
      id: 'parameters',
      name: 'Additional Parameters',
      type: 'text',
      required: false,
      placeholder: '--ar 16:9 --v 6',
      help: 'Other Midjourney parameters'
    }
  ],
  validation: {
    required: ['promptText', 'style_reference'],
    optional: ['parameters']
  },
  examples: [
    'A futuristic city skyline --sref ABC12345',
    'Portrait of a warrior --sref XYZ67890 --ar 9:16',
    'A magical forest scene --sref DEF45678 --v 6'
  ],
  tips: [
    'Style references must be valid 8+ character codes',
    'Combine with other parameters for best results',
    'Test different style references for variety'
  ],
  color: '#8b7fb8'
};

// Video Full Prompt
export const VIDEO_FULL_PROMPT: ModelPromptType = {
  id: MODEL_PROMPT_TYPES.VIDEO.FULL_PROMPT,
  name: 'Video Generation Prompt',
  description: 'Create text-based prompts for video generation models',
  category: 'Video',
  fields: [
    {
      id: 'promptText',
      name: 'Video Description',
      type: 'textarea',
      required: true,
      placeholder: 'Describe the video you want to generate...',
      validation: {
        minLength: 20,
        maxLength: 2000
      },
      help: 'Describe the scene, action, camera movement, and style'
    },
    {
      id: 'duration',
      name: 'Duration',
      type: 'select',
      required: false,
      options: [
        { value: '3s', label: '3 seconds' },
        { value: '5s', label: '5 seconds' },
        { value: '10s', label: '10 seconds' },
        { value: '15s', label: '15 seconds' }
      ],
      help: 'Choose video duration'
    },
    {
      id: 'style',
      name: 'Video Style',
      type: 'select',
      required: false,
      options: [
        { value: 'cinematic', label: 'Cinematic' },
        { value: 'documentary', label: 'Documentary' },
        { value: 'animation', label: 'Animation' },
        { value: 'realistic', label: 'Realistic' }
      ],
      help: 'Choose the video style'
    },
    {
      id: 'camera_movement',
      name: 'Camera Movement',
      type: 'select',
      required: false,
      options: [
        { value: 'static', label: 'Static' },
        { value: 'pan', label: 'Pan' },
        { value: 'zoom', label: 'Zoom' },
        { value: 'tracking', label: 'Tracking' }
      ],
      help: 'Specify camera movement type'
    }
  ],
  validation: {
    required: ['promptText'],
    optional: ['duration', 'style', 'camera_movement']
  },
  examples: [
    'A drone flying over a mountain landscape at sunset',
    'A car driving through a futuristic city at night',
    'A butterfly landing on a flower in slow motion'
  ],
  tips: [
    'Include camera movements and angles',
    'Describe the pacing and mood',
    'Mention lighting and atmospheric effects'
  ],
  color: '#ff6b9d'
};

// Video JSON Prompt
export const VIDEO_JSON_PROMPT: ModelPromptType = {
  id: MODEL_PROMPT_TYPES.VIDEO.JSON_PROMPT,
  name: 'Video JSON Prompt',
  description: 'Create structured JSON prompts for advanced video generation',
  category: 'Video',
  fields: [
    {
      id: 'promptText',
      name: 'JSON Configuration',
      type: 'json',
      required: true,
      placeholder: '{"scene": "...", "camera": "...", "style": "..."}',
      validation: {
        custom: (value) => {
          try {
            JSON.parse(value);
            return null;
          } catch {
            return 'Invalid JSON format';
          }
        }
      },
      help: 'Enter JSON configuration for video generation'
    },
    {
      id: 'model',
      name: 'Video Model',
      type: 'select',
      required: false,
      options: [
        { value: 'runway', label: 'Runway' },
        { value: 'pika', label: 'Pika Labs' },
        { value: 'sora', label: 'Sora' },
        { value: 'gen2', label: 'Gen-2' }
      ],
      help: 'Select the video generation model'
    }
  ],
  validation: {
    required: ['promptText'],
    optional: ['model']
  },
  examples: [
    `{
  "scene": "A peaceful lake at dawn",
  "camera": "Static wide shot",
  "style": "Cinematic",
  "duration": 5
}`,
    `{
  "prompt": "A car driving through a city",
  "parameters": {
    "aspect_ratio": "16:9",
    "fps": 24
  }
}`
  ],
  tips: [
    'Use valid JSON syntax',
    'Include all required fields for your chosen model',
    'Test with simple configurations first'
  ],
  color: '#9d4edd'
};

// Workflow n8n
export const WORKFLOW_N8N_PROMPT: ModelPromptType = {
  id: MODEL_PROMPT_TYPES.WORKFLOW.N8N,
  name: 'n8n Workflow',
  description: 'Create n8n workflow automation prompts',
  category: 'Workflow',
  fields: [
    {
      id: 'promptText',
      name: 'Workflow Description',
      type: 'textarea',
      required: true,
      placeholder: 'Describe the automation workflow...',
      validation: {
        minLength: 20,
        maxLength: 1000
      },
      help: 'Describe what the workflow should automate'
    },
    {
      id: 'workflow_steps',
      name: 'Workflow Steps',
      type: 'multiselect',
      required: true,
      options: [
        { value: 'trigger', label: 'Trigger' },
        { value: 'http_request', label: 'HTTP Request' },
        { value: 'data_processing', label: 'Data Processing' },
        { value: 'email', label: 'Email' },
        { value: 'database', label: 'Database' },
        { value: 'file_operation', label: 'File Operation' }
      ],
      help: 'Select the types of steps in your workflow'
    },
    {
      id: 'complexity',
      name: 'Complexity Level',
      type: 'select',
      required: false,
      options: [
        { value: 'simple', label: 'Simple (1-3 nodes)' },
        { value: 'medium', label: 'Medium (4-8 nodes)' },
        { value: 'complex', label: 'Complex (9+ nodes)' }
      ],
      help: 'Choose the complexity level'
    }
  ],
  validation: {
    required: ['promptText', 'workflow_steps'],
    optional: ['complexity']
  },
  examples: [
    'Automate sending welcome emails when new users sign up',
    'Create a workflow to process and store form submissions',
    'Build an automation to sync data between different services'
  ],
  tips: [
    'Be specific about triggers and actions',
    'Mention data sources and destinations',
    'Include error handling requirements'
  ],
  color: '#8b7fb8'
};

// All prompt types
export const ALL_PROMPT_TYPES: ModelPromptType[] = [
  CHATGPT_TEXT_PROMPT,
  CHATGPT_IMAGE_PROMPT,
  MIDJOURNEY_FULL_PROMPT,
  MIDJOURNEY_STYLE_REF_PROMPT,
  VIDEO_FULL_PROMPT,
  VIDEO_JSON_PROMPT,
  WORKFLOW_N8N_PROMPT
];

// Helper functions
export function getPromptTypeById(id: string): ModelPromptType | undefined {
  return ALL_PROMPT_TYPES.find(type => type.id === id);
}

export function getPromptTypesByCategory(category: string): ModelPromptType[] {
  return ALL_PROMPT_TYPES.filter(type => type.category === category);
}

export function validatePromptData(data: any, promptType: ModelPromptType): Record<string, string> {
  const errors: Record<string, string> = {};

  // Check required fields
  promptType.validation.required.forEach(fieldId => {
    const field = promptType.fields.find(f => f.id === fieldId);
    if (field && (!data[fieldId] || data[fieldId].toString().trim() === '')) {
      errors[fieldId] = `${field.name} is required`;
    }
  });

  // Validate field-specific rules
  promptType.fields.forEach(field => {
    const value = data[field.id];
    if (value && field.validation) {
      if (field.validation.minLength && value.length < field.validation.minLength) {
        errors[field.id] = `${field.name} must be at least ${field.validation.minLength} characters`;
      }
      if (field.validation.maxLength && value.length > field.validation.maxLength) {
        errors[field.id] = `${field.name} must be no more than ${field.validation.maxLength} characters`;
      }
      if (field.validation.pattern && !field.validation.pattern.test(value)) {
        errors[field.id] = `${field.name} format is invalid`;
      }
      if (field.validation.custom) {
        const customError = field.validation.custom(value);
        if (customError) {
          errors[field.id] = customError;
        }
      }
    }
  });

  // Custom validation
  if (promptType.validation.custom) {
    const customErrors = promptType.validation.custom(data);
    Object.assign(errors, customErrors);
  }

  return errors;
} 
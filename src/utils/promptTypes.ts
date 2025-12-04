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

// Claude Text Prompt
export const CLAUDE_TEXT_PROMPT: ModelPromptType = {
  id: 'claude-text',
  name: 'Claude Text Prompt',
  description: 'Create text-based prompts optimized for Claude AI',
  category: 'Claude',
  fields: [
    {
      id: 'promptText',
      name: 'Prompt Text',
      type: 'textarea',
      required: true,
      placeholder: 'Enter your prompt here...',
      validation: {
        minLength: 10,
        maxLength: 3000
      },
      help: 'Claude works best with clear, detailed instructions'
    },
    {
      id: 'thinking_style',
      name: 'Thinking Style',
      type: 'select',
      required: false,
      options: [
        { value: 'analytical', label: 'Analytical' },
        { value: 'creative', label: 'Creative' },
        { value: 'balanced', label: 'Balanced' },
        { value: 'step_by_step', label: 'Step-by-step' }
      ],
      help: 'How Claude should approach the task'
    },
    {
      id: 'output_format',
      name: 'Output Format',
      type: 'select',
      required: false,
      options: [
        { value: 'paragraph', label: 'Paragraph' },
        { value: 'bullet_points', label: 'Bullet Points' },
        { value: 'numbered_list', label: 'Numbered List' },
        { value: 'markdown', label: 'Markdown' },
        { value: 'json', label: 'JSON' }
      ],
      help: 'Preferred response format'
    },
    {
      id: 'use_case',
      name: 'Use Case',
      type: 'select',
      required: false,
      options: [
        { value: 'research', label: 'Research' },
        { value: 'writing', label: 'Writing' },
        { value: 'analysis', label: 'Analysis' },
        { value: 'coding', label: 'Coding' },
        { value: 'brainstorming', label: 'Brainstorming' }
      ],
      help: 'Primary use case for this prompt'
    }
  ],
  validation: {
    required: ['promptText'],
    optional: ['thinking_style', 'output_format', 'use_case']
  },
  examples: [
    'Analyze the key themes in this text and provide insights',
    'Write a comprehensive guide on sustainable living practices',
    'Help me brainstorm innovative solutions for remote team collaboration'
  ],
  tips: [
    'Be specific about what you want Claude to focus on',
    'Include context and background information when relevant',
    'Specify the desired tone and style for responses'
  ],
  color: '#f97316'
};

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
        { value: 'gpt-5-2025-08-07', label: 'GPT-5' },
        { value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1' }
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

// GPT Builder Prompt
export const CHATGPT_GPT_BUILDER: ModelPromptType = {
  id: MODEL_PROMPT_TYPES.CHATGPT.GPT_BUILDER,
  name: 'GPT Builder',
  description: 'Create custom GPT configurations for ChatGPT',
  category: 'GPTs Builder',
  fields: [
    {
      id: 'gpt_name',
      name: 'GPT Name',
      type: 'text',
      required: true,
      placeholder: 'My Custom GPT',
      validation: {
        minLength: 3,
        maxLength: 50
      },
      help: 'Give your GPT a memorable name'
    },
    {
      id: 'promptText',
      name: 'System Instructions',
      type: 'textarea',
      required: true,
      placeholder: 'You are a helpful assistant that...',
      validation: {
        minLength: 50,
        maxLength: 8000
      },
      help: 'Define how your GPT should behave and respond'
    },
    {
      id: 'gpt_description',
      name: 'Description',
      type: 'textarea',
      required: false,
      placeholder: 'This GPT helps users with...',
      validation: {
        maxLength: 300
      },
      help: 'Brief description shown to users'
    },
    {
      id: 'conversation_starters',
      name: 'Conversation Starters',
      type: 'textarea',
      required: false,
      placeholder: 'Enter each starter on a new line',
      help: 'Suggested prompts users can click to start a conversation'
    },
    {
      id: 'capabilities',
      name: 'Capabilities',
      type: 'multiselect',
      required: false,
      options: [
        { value: 'web_browsing', label: 'Web Browsing' },
        { value: 'code_interpreter', label: 'Code Interpreter' },
        { value: 'dalle', label: 'DALL-E Image Generation' },
        { value: 'file_upload', label: 'File Upload' }
      ],
      help: 'Select which capabilities your GPT should have'
    },
    {
      id: 'tone',
      name: 'Response Tone',
      type: 'select',
      required: false,
      options: [
        { value: 'professional', label: 'Professional' },
        { value: 'friendly', label: 'Friendly' },
        { value: 'casual', label: 'Casual' },
        { value: 'formal', label: 'Formal' },
        { value: 'enthusiastic', label: 'Enthusiastic' }
      ],
      help: 'The overall tone of GPT responses'
    }
  ],
  validation: {
    required: ['gpt_name', 'promptText'],
    optional: ['gpt_description', 'conversation_starters', 'capabilities', 'tone']
  },
  examples: [
    'Create a coding assistant that helps debug Python code',
    'Build a creative writing coach that provides feedback',
    'Design a meal planning assistant for healthy eating'
  ],
  tips: [
    'Be specific about what your GPT should and should not do',
    'Include example interactions in your instructions',
    'Define clear boundaries and response formats'
  ],
  color: '#10a37f'
};

// Gemini Image Prompt (Nano Banana)
export const GEMINI_IMAGE_PROMPT: ModelPromptType = {
  id: MODEL_PROMPT_TYPES.GEMINI.IMAGE,
  name: 'Gemini Image (Nano Banana)',
  description: 'Create image generation prompts for Google Gemini/Nano Banana',
  category: 'Gemini',
  fields: [
    {
      id: 'promptText',
      name: 'Image Description',
      type: 'textarea',
      required: true,
      placeholder: 'A photorealistic image of...',
      validation: {
        minLength: 10,
        maxLength: 2000
      },
      help: 'Describe the image you want to generate in detail'
    },
    {
      id: 'style',
      name: 'Art Style',
      type: 'select',
      required: false,
      options: [
        { value: 'photorealistic', label: 'Photorealistic' },
        { value: 'digital_art', label: 'Digital Art' },
        { value: 'illustration', label: 'Illustration' },
        { value: 'painting', label: 'Painting' },
        { value: 'anime', label: 'Anime' },
        { value: '3d_render', label: '3D Render' },
        { value: 'watercolor', label: 'Watercolor' },
        { value: 'sketch', label: 'Sketch' }
      ],
      help: 'Choose the artistic style for your image'
    },
    {
      id: 'aspect_ratio',
      name: 'Aspect Ratio',
      type: 'select',
      required: false,
      options: [
        { value: '1:1', label: 'Square (1:1)' },
        { value: '16:9', label: 'Landscape (16:9)' },
        { value: '9:16', label: 'Portrait (9:16)' },
        { value: '4:3', label: 'Standard (4:3)' },
        { value: '3:2', label: 'Photo (3:2)' }
      ],
      help: 'Select the image dimensions'
    },
    {
      id: 'mood',
      name: 'Mood/Atmosphere',
      type: 'select',
      required: false,
      options: [
        { value: 'bright', label: 'Bright & Cheerful' },
        { value: 'dark', label: 'Dark & Moody' },
        { value: 'cinematic', label: 'Cinematic' },
        { value: 'dreamy', label: 'Dreamy' },
        { value: 'vintage', label: 'Vintage' },
        { value: 'futuristic', label: 'Futuristic' }
      ],
      help: 'Set the overall mood of the image'
    },
    {
      id: 'negative_prompt',
      name: 'Negative Prompt',
      type: 'textarea',
      required: false,
      placeholder: 'Things to avoid: blurry, low quality...',
      help: 'Describe what you do NOT want in the image'
    }
  ],
  validation: {
    required: ['promptText'],
    optional: ['style', 'aspect_ratio', 'mood', 'negative_prompt']
  },
  examples: [
    'A serene Japanese garden with cherry blossoms and a koi pond',
    'A futuristic cityscape at night with neon lights and flying cars',
    'A cozy coffee shop interior with warm lighting and vintage decor'
  ],
  tips: [
    'Be specific about colors, lighting, and composition',
    'Include details about the environment and setting',
    'Use descriptive adjectives for better results'
  ],
  color: '#4285f4'
};

// Flux Image Prompt
export const FLUX_IMAGE_PROMPT: ModelPromptType = {
  id: MODEL_PROMPT_TYPES.FLUX.IMAGE,
  name: 'Flux Image Prompt',
  description: 'Create image generation prompts for Flux and Stable Diffusion',
  category: 'Flux',
  fields: [
    {
      id: 'promptText',
      name: 'Image Description',
      type: 'textarea',
      required: true,
      placeholder: 'Describe the image in detail...',
      validation: {
        minLength: 10,
        maxLength: 2000
      },
      help: 'Detailed description of the image you want to generate'
    },
    {
      id: 'negative_prompt',
      name: 'Negative Prompt',
      type: 'textarea',
      required: false,
      placeholder: 'bad quality, blurry, distorted...',
      help: 'What to avoid in the generated image'
    },
    {
      id: 'model_version',
      name: 'Model Version',
      type: 'select',
      required: false,
      options: [
        { value: 'flux-pro', label: 'Flux Pro' },
        { value: 'flux-dev', label: 'Flux Dev' },
        { value: 'flux-schnell', label: 'Flux Schnell (Fast)' },
        { value: 'sd-xl', label: 'Stable Diffusion XL' }
      ],
      help: 'Select the model version for generation'
    },
    {
      id: 'style_preset',
      name: 'Style Preset',
      type: 'select',
      required: false,
      options: [
        { value: 'photographic', label: 'Photographic' },
        { value: 'digital-art', label: 'Digital Art' },
        { value: 'anime', label: 'Anime' },
        { value: 'cinematic', label: 'Cinematic' },
        { value: 'fantasy-art', label: 'Fantasy Art' },
        { value: 'neon-punk', label: 'Neon Punk' },
        { value: 'isometric', label: 'Isometric' }
      ],
      help: 'Choose a predefined style preset'
    },
    {
      id: 'guidance_scale',
      name: 'Guidance Scale',
      type: 'number',
      required: false,
      defaultValue: 7.5,
      help: 'How closely to follow the prompt (1-20)'
    }
  ],
  validation: {
    required: ['promptText'],
    optional: ['negative_prompt', 'model_version', 'style_preset', 'guidance_scale']
  },
  examples: [
    'A mystical forest with bioluminescent plants and fireflies',
    'Portrait of a cyberpunk character with neon accents',
    'An abstract geometric pattern with vibrant colors'
  ],
  tips: [
    'Include quality tags like "highly detailed", "8k resolution"',
    'Use negative prompts to avoid common issues',
    'Experiment with different guidance scales'
  ],
  color: '#9333ea'
};

// Sora Video Prompt
export const SORA_VIDEO_PROMPT: ModelPromptType = {
  id: MODEL_PROMPT_TYPES.SORA.VIDEO,
  name: 'Sora Video Prompt',
  description: 'Create video generation prompts for OpenAI Sora',
  category: 'Video AI',
  fields: [
    {
      id: 'promptText',
      name: 'Video Description',
      type: 'textarea',
      required: true,
      placeholder: 'A cinematic shot of...',
      validation: {
        minLength: 20,
        maxLength: 3000
      },
      help: 'Describe the video scene, action, and visual style'
    },
    {
      id: 'duration',
      name: 'Duration',
      type: 'select',
      required: false,
      options: [
        { value: '5s', label: '5 seconds' },
        { value: '10s', label: '10 seconds' },
        { value: '15s', label: '15 seconds' },
        { value: '20s', label: '20 seconds' }
      ],
      help: 'Target video duration'
    },
    {
      id: 'aspect_ratio',
      name: 'Aspect Ratio',
      type: 'select',
      required: false,
      options: [
        { value: '16:9', label: 'Widescreen (16:9)' },
        { value: '9:16', label: 'Vertical (9:16)' },
        { value: '1:1', label: 'Square (1:1)' },
        { value: '21:9', label: 'Cinematic (21:9)' }
      ],
      help: 'Video dimensions'
    },
    {
      id: 'camera_movement',
      name: 'Camera Movement',
      type: 'select',
      required: false,
      options: [
        { value: 'static', label: 'Static' },
        { value: 'pan_left', label: 'Pan Left' },
        { value: 'pan_right', label: 'Pan Right' },
        { value: 'tilt_up', label: 'Tilt Up' },
        { value: 'tilt_down', label: 'Tilt Down' },
        { value: 'zoom_in', label: 'Zoom In' },
        { value: 'zoom_out', label: 'Zoom Out' },
        { value: 'tracking', label: 'Tracking Shot' },
        { value: 'dolly', label: 'Dolly Movement' },
        { value: 'drone', label: 'Drone Shot' }
      ],
      help: 'Specify camera movement style'
    },
    {
      id: 'video_style',
      name: 'Video Style',
      type: 'select',
      required: false,
      options: [
        { value: 'cinematic', label: 'Cinematic' },
        { value: 'documentary', label: 'Documentary' },
        { value: 'animation', label: 'Animation' },
        { value: 'slow_motion', label: 'Slow Motion' },
        { value: 'timelapse', label: 'Timelapse' }
      ],
      help: 'Overall video aesthetic'
    }
  ],
  validation: {
    required: ['promptText'],
    optional: ['duration', 'aspect_ratio', 'camera_movement', 'video_style']
  },
  examples: [
    'A drone shot flying over a misty mountain range at sunrise',
    'A close-up of rain drops falling on a leaf in slow motion',
    'A bustling Tokyo street at night with neon signs and crowds'
  ],
  tips: [
    'Describe the scene progression from start to end',
    'Include camera movement instructions',
    'Specify lighting and atmosphere details'
  ],
  color: '#ef4444'
};

// ElevenLabs Voice Prompt
export const ELEVENLABS_VOICE_PROMPT: ModelPromptType = {
  id: MODEL_PROMPT_TYPES.ELEVENLABS.VOICE,
  name: 'ElevenLabs Voice Prompt',
  description: 'Create voice generation prompts for ElevenLabs',
  category: 'Audio AI',
  fields: [
    {
      id: 'promptText',
      name: 'Text to Speak',
      type: 'textarea',
      required: true,
      placeholder: 'Enter the text you want converted to speech...',
      validation: {
        minLength: 5,
        maxLength: 5000
      },
      help: 'The text that will be converted to speech'
    },
    {
      id: 'voice_style',
      name: 'Voice Style',
      type: 'select',
      required: false,
      options: [
        { value: 'narrator', label: 'Narrator' },
        { value: 'conversational', label: 'Conversational' },
        { value: 'professional', label: 'Professional' },
        { value: 'dramatic', label: 'Dramatic' },
        { value: 'whisper', label: 'Whisper' },
        { value: 'announcer', label: 'Announcer' }
      ],
      help: 'The speaking style for the voice'
    },
    {
      id: 'emotion',
      name: 'Emotion',
      type: 'select',
      required: false,
      options: [
        { value: 'neutral', label: 'Neutral' },
        { value: 'happy', label: 'Happy' },
        { value: 'sad', label: 'Sad' },
        { value: 'excited', label: 'Excited' },
        { value: 'calm', label: 'Calm' },
        { value: 'serious', label: 'Serious' }
      ],
      help: 'Emotional tone of the speech'
    },
    {
      id: 'speed',
      name: 'Speech Speed',
      type: 'select',
      required: false,
      options: [
        { value: 'slow', label: 'Slow' },
        { value: 'normal', label: 'Normal' },
        { value: 'fast', label: 'Fast' }
      ],
      help: 'Speed of speech delivery'
    },
    {
      id: 'use_case',
      name: 'Use Case',
      type: 'select',
      required: false,
      options: [
        { value: 'audiobook', label: 'Audiobook' },
        { value: 'podcast', label: 'Podcast' },
        { value: 'video_narration', label: 'Video Narration' },
        { value: 'advertisement', label: 'Advertisement' },
        { value: 'educational', label: 'Educational' }
      ],
      help: 'Intended use for the audio'
    }
  ],
  validation: {
    required: ['promptText'],
    optional: ['voice_style', 'emotion', 'speed', 'use_case']
  },
  examples: [
    'Welcome to our podcast about technology and innovation',
    'Chapter one: It was a dark and stormy night...',
    'Introducing the future of artificial intelligence'
  ],
  tips: [
    'Use punctuation to control pacing and pauses',
    'Match voice style to your content type',
    'Test different emotions for the same text'
  ],
  color: '#f97316'
};

// Suno Music Prompt
export const SUNO_MUSIC_PROMPT: ModelPromptType = {
  id: MODEL_PROMPT_TYPES.SUNO.MUSIC,
  name: 'Suno Music Prompt',
  description: 'Create AI music generation prompts for Suno',
  category: 'Audio AI',
  fields: [
    {
      id: 'promptText',
      name: 'Music Description',
      type: 'textarea',
      required: true,
      placeholder: 'An upbeat electronic track with...',
      validation: {
        minLength: 10,
        maxLength: 1000
      },
      help: 'Describe the music style, mood, and elements'
    },
    {
      id: 'genre',
      name: 'Genre',
      type: 'select',
      required: false,
      options: [
        { value: 'pop', label: 'Pop' },
        { value: 'rock', label: 'Rock' },
        { value: 'electronic', label: 'Electronic' },
        { value: 'hip_hop', label: 'Hip Hop' },
        { value: 'jazz', label: 'Jazz' },
        { value: 'classical', label: 'Classical' },
        { value: 'ambient', label: 'Ambient' },
        { value: 'lofi', label: 'Lo-Fi' },
        { value: 'cinematic', label: 'Cinematic' }
      ],
      help: 'Primary music genre'
    },
    {
      id: 'mood',
      name: 'Mood',
      type: 'select',
      required: false,
      options: [
        { value: 'happy', label: 'Happy' },
        { value: 'sad', label: 'Sad' },
        { value: 'energetic', label: 'Energetic' },
        { value: 'relaxing', label: 'Relaxing' },
        { value: 'epic', label: 'Epic' },
        { value: 'mysterious', label: 'Mysterious' },
        { value: 'romantic', label: 'Romantic' }
      ],
      help: 'Overall mood of the track'
    },
    {
      id: 'tempo',
      name: 'Tempo',
      type: 'select',
      required: false,
      options: [
        { value: 'slow', label: 'Slow (60-80 BPM)' },
        { value: 'moderate', label: 'Moderate (80-120 BPM)' },
        { value: 'fast', label: 'Fast (120-150 BPM)' },
        { value: 'very_fast', label: 'Very Fast (150+ BPM)' }
      ],
      help: 'Speed of the music'
    },
    {
      id: 'instruments',
      name: 'Key Instruments',
      type: 'text',
      required: false,
      placeholder: 'piano, synth, drums, guitar...',
      help: 'Specific instruments to include'
    }
  ],
  validation: {
    required: ['promptText'],
    optional: ['genre', 'mood', 'tempo', 'instruments']
  },
  examples: [
    'A chill lo-fi hip hop beat for studying with soft piano',
    'Epic orchestral music for a fantasy movie trailer',
    'Upbeat electronic dance track with heavy bass drops'
  ],
  tips: [
    'Describe the energy progression of the track',
    'Reference similar artists or songs for style',
    'Specify if you want vocals or instrumental only'
  ],
  color: '#8b5cf6'
};

// All prompt types
export const ALL_PROMPT_TYPES: ModelPromptType[] = [
  CHATGPT_TEXT_PROMPT,
  CHATGPT_IMAGE_PROMPT,
  CHATGPT_GPT_BUILDER,
  CLAUDE_TEXT_PROMPT,
  MIDJOURNEY_FULL_PROMPT,
  MIDJOURNEY_STYLE_REF_PROMPT,
  GEMINI_IMAGE_PROMPT,
  FLUX_IMAGE_PROMPT,
  SORA_VIDEO_PROMPT,
  ELEVENLABS_VOICE_PROMPT,
  SUNO_MUSIC_PROMPT,
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
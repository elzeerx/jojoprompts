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
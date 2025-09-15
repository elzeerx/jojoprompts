
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  first_name?: string | null;
  last_name?: string | null;
}

export interface LocalePrompt {
  title?: string;
  prompt_text?: string;
}

export interface Prompt {
  id: string;
  user_id: string;
  title: string;
  prompt_text: string;
  image_path: string | null;
  image_url?: string | null;
  default_image_path?: string | null;
  prompt_type: 'text' | 'image' | 'workflow' | 'video' | 'sound' | 'button' | 'image-selection';
  metadata: {
    category?: string;
    style?: string;
    tags?: string[];
    target_model?: string;
    use_case?: string;
    button_text?: string;
    button_action?: string;
    image_options?: string[];
    translations?: {
      arabic?: LocalePrompt;
      english?: LocalePrompt;
    };
    media_files?: Array<{
      type: 'image' | 'video' | 'audio';
      path: string;
      name: string;
    }>;
    workflow_steps?: {
      name: string;
      description: string;
    }[];
    workflow_files?: Array<{
      type: 'json' | 'zip';
      path: string;
      name: string;
    }>;
    buttons?: Array<{ id: string; name: string; description: string; type: string }>;
  };
  created_at: string;
}

export interface PromptRow {
  id: string;
  user_id: string;
  title: string;
  prompt_text: string;
  image_path: string | null;
  image_url?: string | null;
  default_image_path?: string | null;
  created_at: string | null;
  metadata: {
    category?: string;
    style?: string;
    tags?: string[];
    target_model?: string;
    use_case?: string;
    button_text?: string;
    button_action?: string;
    image_options?: string[];
    translations?: {
      arabic?: LocalePrompt;
      english?: LocalePrompt;
    };
    media_files?: Array<{
      type: 'image' | 'video' | 'audio';
      path: string;
      name: string;
    }>;
    workflow_steps?: {
      name: string;
      description: string;
    }[];
    workflow_files?: Array<{
      type: 'json' | 'zip';
      path: string;
      name: string;
    }>;
    buttons?: Array<{ id: string; name: string; description: string; type: string }>;
  };
  prompt_type: 'text' | 'image' | 'workflow' | 'video' | 'sound' | 'button' | 'image-selection';
}

// UserProfile has been moved to @/types/user.ts for better organization
export type { UserProfile, ExtendedUserProfile, UserRole } from "@/types/user";

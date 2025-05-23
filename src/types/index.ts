
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  first_name?: string | null;
  last_name?: string | null;
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
    workflow_steps?: {
      name: string;
      description: string;
    }[];
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
    workflow_steps?: {
      name: string;
      description: string;
    }[];
    buttons?: Array<{ id: string; name: string; description: string; type: string }>;
  };
  prompt_type: 'text' | 'image' | 'workflow' | 'video' | 'sound' | 'button' | 'image-selection';
}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  role: string;
  last_sign_in_at: string | null;
}


export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

export interface Prompt {
  id: string;
  user_id: string;
  title: string;
  prompt_text: string;
  image_url: string | null;
  metadata: {
    category?: string;
    style?: string;
    tags?: string[];
  };
  created_at: string;
}

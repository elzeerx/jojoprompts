
// Re-export standardized types from the main types file
export interface UserData {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  role?: 'user' | 'admin' | 'prompter' | 'jadmin';
}

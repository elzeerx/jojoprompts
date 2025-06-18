
export interface AuthContext {
  supabase: any;
  userId: string;
  userRole: string;
  permissions: string[];
}

export interface SecurityCheckParams {
  supabase: any;
  userId: string;
  profile: any;
}

export interface SecurityEvent {
  user_id: string;
  action: string;
  details: Record<string, any>;
}

export interface RequestValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Common TypeScript types to eliminate 'any' usage
 */

// Authentication & User Types
export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at?: string;
  email_confirmed_at?: string;
  last_sign_in_at?: string;
  raw_user_meta_data?: Record<string, any>;
  user_metadata?: Record<string, any>;
}

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  role: UserRole;
  membership_tier?: string;
  bio?: string;
  avatar_url?: string;
  phone_number?: string;
  country?: string;
  timezone?: string;
  social_links?: Record<string, string>;
  created_at: string;
}

export type UserRole = 'user' | 'admin' | 'prompter' | 'jadmin';

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: User;
}

// Payment & Subscription Types
export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price_usd: number;
  duration_days?: number;
  is_lifetime: boolean;
  features: string[];
  excluded_features: string[];
  created_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  start_date: string;
  end_date?: string;
  payment_method: string;
  payment_id?: string;
  transaction_id?: string;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending';

export interface Transaction {
  id: string;
  user_id: string;
  plan_id: string;
  amount_usd: number;
  status: TransactionStatus;
  paypal_order_id?: string;
  paypal_payment_id?: string;
  is_upgrade?: boolean;
  upgrade_from_plan_id?: string;
  error_message?: string;
  completed_at?: string;
  created_at: string;
}

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface DiscountCode {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  is_active: boolean;
  expiration_date?: string;
  usage_limit?: number;
  times_used: number;
  applies_to_all_plans: boolean;
  applicable_plans: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type DiscountType = 'percentage' | 'fixed_amount';

export interface DiscountValidation {
  id: string;
  discount_type: DiscountType;
  discount_value: number;
  is_valid: boolean;
  error_message: string;
}

// Prompt & Content Types
export interface Prompt {
  id: string;
  title: string;
  prompt_text: string;
  prompt_type: PromptType;
  user_id: string;
  image_path?: string;
  default_image_path?: string;
  metadata: PromptMetadata;
  created_at: string;
}

export type PromptType = 'image' | 'text' | 'video' | 'workflow';

export interface PromptMetadata {
  category?: string;
  tags?: string[];
  model?: string;
  use_case?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  style?: string;
  output_format?: string;
  parameters?: Record<string, any>;
  workflow_steps?: WorkflowStep[];
  file_paths?: FilePaths;
  [key: string]: any;
}

export interface WorkflowStep {
  step_number: number;
  title: string;
  description: string;
  tool?: string;
  parameters?: Record<string, any>;
}

export interface FilePaths {
  images?: string[];
  videos?: string[];
  audio?: string[];
  files?: string[];
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  link_path: string;
  icon_name: string;
  icon_image_path?: string;
  image_path?: string;
  bg_gradient: string;
  required_plan: string;
  features: string[];
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
  success: boolean;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Form & Validation Types
export interface FormField<T = any> {
  name: string;
  value: T;
  error?: string;
  touched: boolean;
  required?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// State Management Types
export interface LoadingState {
  isLoading: boolean;
  error?: string;
  data?: any;
}

export interface AsyncAction<T = any> {
  loading: boolean;
  error: string | null;
  data: T | null;
  execute: (...args: any[]) => Promise<void>;
  reset: () => void;
}

// Security & Monitoring Types
export interface SecurityEvent {
  action: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface RolePermissions {
  isAdmin: boolean;
  isJadmin: boolean;
  isPrompter: boolean;
  canManagePrompts: boolean;
  canAccessAdmin: boolean;
  canManageUsers: boolean;
  canViewAnalytics: boolean;
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface CardProps extends BaseComponentProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'outline' | 'ghost';
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

// Payment Processing Types
export interface PaymentContextData {
  orderId?: string;
  paymentId?: string;
  planId: string;
  userId: string;
  amount: number;
  appliedDiscount?: DiscountCode;
  timestamp: number;
}

export interface PaymentProcessingOptions {
  success: boolean;
  paymentId?: string;
  orderId?: string;
  planId?: string;
  userId?: string;
  debugObject?: any;
  hasSessionIndependentData: boolean;
}

export interface PaymentVerificationResult {
  success: boolean;
  status: string;
  transactionId?: string;
  subscriptionId?: string;
  error?: string;
}
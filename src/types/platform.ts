/**
 * Platform System Types
 * 
 * Type definitions for the platform-driven dynamic prompt creation system.
 * Supports multiple AI platforms (ChatGPT, Midjourney, Claude, n8n, etc.)
 * with configurable fields and validation rules.
 */

/**
 * Platform category types
 */
export type PlatformCategory = 
  | 'text-to-text'    // ChatGPT, Claude, etc.
  | 'text-to-image'   // Midjourney, DALL-E, etc.
  | 'text-to-video'   // Runway, Pika, etc.
  | 'workflow'        // n8n, Zapier, etc.
  | 'other';

/**
 * Field type definitions
 */
export type FieldType = 
  | 'text'      // Single line text input
  | 'textarea'  // Multi-line text input
  | 'select'    // Dropdown selection
  | 'number'    // Number input
  | 'slider'    // Range slider
  | 'toggle'    // Boolean toggle/switch
  | 'code';     // Code editor (for JSON, etc.)

/**
 * Conditional logic operators
 */
export type ConditionalOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than';

/**
 * Platform interface - Represents an AI platform/service
 */
export interface Platform {
  id: string;
  name: string;
  slug: string;
  category: PlatformCategory;
  icon: string;
  description: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Validation rules for form fields
 */
export interface ValidationRules {
  min?: number;
  max?: number;
  step?: number;
  pattern?: string;
  required?: boolean;
  [key: string]: any; // Allow additional validation rules
}

/**
 * Option for select/dropdown fields
 */
export interface FieldOption {
  label: string;
  value: string;
}

/**
 * Conditional logic for showing/hiding fields
 */
export interface ConditionalLogic {
  field: string;
  operator: ConditionalOperator;
  value: any;
}

/**
 * Platform field configuration
 * Defines a dynamic form field for a specific platform
 */
export interface PlatformField {
  id: string;
  platform_id: string;
  field_key: string;
  field_type: FieldType;
  label: string;
  placeholder?: string;
  default_value?: string;
  is_required: boolean;
  validation_rules?: ValidationRules;
  options?: FieldOption[];
  help_text?: string;
  display_order: number;
  conditional_logic?: ConditionalLogic;
  created_at: string;
  updated_at: string;
}

/**
 * Prompt template for quick-start configurations
 */
export interface PromptTemplate {
  id: string;
  platform_id: string;
  name: string;
  description: string;
  template_values: Record<string, any>;
  is_featured: boolean;
  created_at: string;
}

/**
 * Extended platform with its fields included
 */
export interface PlatformWithFields extends Platform {
  fields: PlatformField[];
}

/**
 * Platform field values (user input)
 */
export interface PlatformFieldValues {
  [fieldKey: string]: any;
}

/**
 * Complete prompt data with platform information
 */
export interface PlatformPrompt {
  id: string;
  user_id: string;
  platform_id: string;
  title: string;
  prompt_text: string;
  title_ar?: string;
  prompt_text_ar?: string;
  platform_fields: PlatformFieldValues;
  metadata?: Record<string, any>;
  image_path?: string;
  default_image_path?: string;
  version: number;
  created_at: string;
}

/**
 * Database table types (from Supabase)
 */
export interface Database {
  public: {
    Tables: {
      platforms: {
        Row: Platform;
        Insert: Omit<Platform, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Platform, 'id' | 'created_at' | 'updated_at'>>;
      };
      platform_fields: {
        Row: PlatformField;
        Insert: Omit<PlatformField, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PlatformField, 'id' | 'created_at' | 'updated_at'>>;
      };
      prompt_templates: {
        Row: PromptTemplate;
        Insert: Omit<PromptTemplate, 'id' | 'created_at'>;
        Update: Partial<Omit<PromptTemplate, 'id' | 'created_at'>>;
      };
    };
  };
}

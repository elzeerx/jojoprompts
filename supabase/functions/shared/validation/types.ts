
// Core validation types and interfaces
export interface ValidationRule {
  required?: boolean;
  type: 'string' | 'number' | 'boolean' | 'uuid' | 'email' | 'url';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  allowedValues?: string[];
  sanitize?: boolean;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData: Record<string, any>;
}

export interface FieldValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue: any;
}

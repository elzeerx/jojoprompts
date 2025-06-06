
// Core validation types and interfaces
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

export interface TextValidationOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  allowedChars?: RegExp;
}

export interface NumberValidationOptions {
  required?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
}

export interface FileValidationOptions {
  allowedTypes: string[];
  maxSizeMB: number;
  required?: boolean;
}

export interface ValidationRule {
  type: 'email' | 'password' | 'text' | 'uuid' | 'number' | 'file';
  fieldName?: string;
  options?: any;
}

import { PlatformField } from '@/types/platform';

/**
 * Result of validating a single field value
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Results for multiple fields (keyed by field_key)
 */
export interface FieldValidationResult {
  [fieldKey: string]: ValidationResult;
}

/**
 * Function that validates a value against a field configuration
 */
export type ValidatorFunction = (value: any, field: PlatformField) => ValidationResult;

/**
 * Types of validation rules supported
 */
export type ValidationRuleType = 
  | 'required' 
  | 'min' 
  | 'max' 
  | 'minLength' 
  | 'maxLength' 
  | 'pattern' 
  | 'email' 
  | 'url' 
  | 'json'
  | 'custom';

/**
 * Validation rule configuration
 */
export interface ValidationRule {
  type: ValidationRuleType;
  message?: string;
  validator?: (value: any) => boolean;
}

/**
 * Form validation state for React hooks
 */
export interface FormValidationState {
  errors: FieldValidationResult;
  isValid: boolean;
  isDirty: boolean;
  touchedFields: Set<string>;
}

/**
 * Options for field validation
 */
export interface ValidationOptions {
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  stopOnFirstError?: boolean;
}

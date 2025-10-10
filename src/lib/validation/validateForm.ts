import { PlatformField } from '@/types/platform';
import { FieldValidationResult } from './types';
import { validateField } from './validateField';

/**
 * Validates all fields in a form
 */
export function validateForm(
  values: Record<string, any>,
  fields: PlatformField[]
): FieldValidationResult {
  const results: FieldValidationResult = {};
  
  fields.forEach(field => {
    const value = values[field.field_key];
    const result = validateField(value, field);
    
    results[field.field_key] = result;
  });
  
  return results;
}

/**
 * Checks if form has any validation errors
 */
export function hasFormErrors(validationResults: FieldValidationResult): boolean {
  return Object.values(validationResults).some(result => !result.isValid);
}

/**
 * Gets all error messages from validation results
 */
export function getFormErrors(validationResults: FieldValidationResult): string[] {
  const allErrors: string[] = [];
  
  Object.values(validationResults).forEach(result => {
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
  });
  
  return allErrors;
}

/**
 * Gets the first error for a specific field
 */
export function getFieldError(
  validationResults: FieldValidationResult,
  fieldKey: string
): string | undefined {
  const result = validationResults[fieldKey];
  return result && !result.isValid ? result.errors[0] : undefined;
}

/**
 * Gets all errors for a specific field
 */
export function getFieldErrors(
  validationResults: FieldValidationResult,
  fieldKey: string
): string[] {
  const result = validationResults[fieldKey];
  return result && !result.isValid ? result.errors : [];
}

/**
 * Counts total number of validation errors
 */
export function getErrorCount(validationResults: FieldValidationResult): number {
  return Object.values(validationResults).filter(result => !result.isValid).length;
}

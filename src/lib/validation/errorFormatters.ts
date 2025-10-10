import { FieldValidationResult, ValidationResult } from './types';

/**
 * Formats a single field's validation errors into a string
 */
export function formatFieldErrors(result: ValidationResult): string {
  return result.errors.join(', ');
}

/**
 * Formats all validation errors into a single error message
 */
export function formatAllErrors(results: FieldValidationResult): string {
  const allErrors: string[] = [];

  for (const [fieldKey, result] of Object.entries(results)) {
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
  }

  return allErrors.join('; ');
}

/**
 * Gets the first error message from validation results
 */
export function getFirstError(results: FieldValidationResult): string | null {
  for (const [fieldKey, result] of Object.entries(results)) {
    if (!result.isValid && result.errors.length > 0) {
      return result.errors[0];
    }
  }
  return null;
}

/**
 * Groups errors by field for display
 */
export function groupErrorsByField(results: FieldValidationResult): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  for (const [fieldKey, result] of Object.entries(results)) {
    if (!result.isValid) {
      grouped[fieldKey] = result.errors;
    }
  }

  return grouped;
}

/**
 * Checks if any field has errors
 */
export function hasErrors(results: FieldValidationResult): boolean {
  return Object.values(results).some(result => !result.isValid);
}

/**
 * Gets count of fields with errors
 */
export function getErrorCount(results: FieldValidationResult): number {
  return Object.values(results).filter(result => !result.isValid).length;
}

/**
 * Formats errors for display in a toast notification
 */
export function formatErrorsForToast(results: FieldValidationResult): {
  title: string;
  description: string;
} {
  const errorCount = getErrorCount(results);
  const firstError = getFirstError(results);

  if (errorCount === 0) {
    return {
      title: 'Success',
      description: 'All fields are valid'
    };
  }

  if (errorCount === 1) {
    return {
      title: 'Validation Error',
      description: firstError || 'Please fix the error and try again'
    };
  }

  return {
    title: 'Validation Errors',
    description: `Please fix ${errorCount} errors and try again`
  };
}

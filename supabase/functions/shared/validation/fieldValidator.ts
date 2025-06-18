
// Field-level validation logic
import { ValidationRule, FieldValidationResult } from './types.ts';
import { FieldValidators } from './validators.ts';

export class FieldValidator {
  static validateField(
    fieldName: string,
    value: any,
    rule: ValidationRule
  ): FieldValidationResult {
    const errors: string[] = [];
    let sanitizedValue = value;

    try {
      // Type validation
      switch (rule.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`Field '${fieldName}' must be a string`);
            break;
          }
          
          // Length validation
          if (rule.minLength && value.length < rule.minLength) {
            errors.push(`Field '${fieldName}' must be at least ${rule.minLength} characters`);
          }
          if (rule.maxLength && value.length > rule.maxLength) {
            errors.push(`Field '${fieldName}' must be at most ${rule.maxLength} characters`);
          }

          // Pattern validation
          if (rule.pattern && !rule.pattern.test(value)) {
            errors.push(`Field '${fieldName}' has invalid format`);
          }

          // Allowed values validation
          if (rule.allowedValues && !rule.allowedValues.includes(value)) {
            errors.push(`Field '${fieldName}' must be one of: ${rule.allowedValues.join(', ')}`);
          }

          // Security validation
          if (FieldValidators.containsSuspiciousContent(value)) {
            errors.push(`Field '${fieldName}' contains invalid content`);
          }

          // Sanitization
          if (rule.sanitize && errors.length === 0) {
            sanitizedValue = FieldValidators.sanitizeString(value);
          }
          break;

        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(`Field '${fieldName}' must be a valid number`);
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`Field '${fieldName}' must be a boolean`);
          }
          break;

        case 'uuid':
          if (!FieldValidators.isValidUUID(value)) {
            errors.push(`Field '${fieldName}' must be a valid UUID`);
          }
          break;

        case 'email':
          if (!FieldValidators.isValidEmail(value)) {
            errors.push(`Field '${fieldName}' must be a valid email`);
          }
          break;

        case 'url':
          if (!FieldValidators.isValidURL(value)) {
            errors.push(`Field '${fieldName}' must be a valid URL`);
          }
          break;

        default:
          errors.push(`Unknown validation type for field '${fieldName}'`);
      }

    } catch (error) {
      console.error(`Field validation error for ${fieldName}:`, error);
      errors.push(`Validation failed for field '${fieldName}'`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue
    };
  }
}

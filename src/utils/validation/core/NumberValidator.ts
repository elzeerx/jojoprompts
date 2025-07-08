
import { ValidationResult, NumberValidationOptions } from './ValidationTypes';

export class NumberValidator {
  static validateNumber(
    value: any, 
    fieldName: string,
    options: NumberValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const { required = true, min, max, integer = false } = options;

    if (value === null || value === undefined || value === '') {
      if (required) {
        errors.push(`${fieldName} is required`);
      }
      return { isValid: !required, errors };
    }

    const num = Number(value);
    
    if (isNaN(num)) {
      errors.push(`${fieldName} must be a valid number`);
      return { isValid: false, errors };
    }

    if (integer && !Number.isInteger(num)) {
      errors.push(`${fieldName} must be a whole number`);
    }

    if (min !== undefined && num < min) {
      errors.push(`${fieldName} must be at least ${min}`);
    }

    if (max !== undefined && num > max) {
      errors.push(`${fieldName} must be at most ${max}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: num
    };
  }
}

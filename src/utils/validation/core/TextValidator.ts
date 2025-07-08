
import { SecurityUtils } from '../../security';
import { ValidationResult, TextValidationOptions } from './ValidationTypes';

export class TextValidator {
  static validateText(
    input: string, 
    fieldName: string, 
    options: TextValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];
    const { required = true, minLength = 0, maxLength = 1000, allowedChars } = options;

    if (!input && required) {
      errors.push(`${fieldName} is required`);
      return { isValid: false, errors };
    }

    if (input) {
      if (input.length < minLength) {
        errors.push(`${fieldName} must be at least ${minLength} characters`);
      }

      if (input.length > maxLength) {
        errors.push(`${fieldName} must be less than ${maxLength} characters`);
      }

      if (allowedChars && !allowedChars.test(input)) {
        errors.push(`${fieldName} contains invalid characters`);
      }

      if (SecurityUtils.containsXSS(input) || SecurityUtils.containsSQLInjection(input)) {
        errors.push(`${fieldName} contains potentially harmful content`);
      }
    }

    const sanitizedValue = input ? SecurityUtils.sanitizeUserInput(input) : '';

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue
    };
  }
}

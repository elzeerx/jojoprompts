
import { SecurityUtils } from '../../security';
import { ValidationResult } from './ValidationTypes';

export class EmailValidator {
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    
    if (!email) {
      errors.push('Email is required');
      return { isValid: false, errors };
    }

    if (!SecurityUtils.isValidEmail(email)) {
      errors.push('Please enter a valid email address');
    }

    if (SecurityUtils.containsXSS(email) || SecurityUtils.containsSQLInjection(email)) {
      errors.push('Email contains invalid characters');
    }

    const sanitizedValue = SecurityUtils.sanitizeUserInput(email);

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue
    };
  }
}

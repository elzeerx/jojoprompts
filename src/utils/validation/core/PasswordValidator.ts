
import { SecurityUtils } from '../../security';
import { ValidationResult } from './ValidationTypes';

export class PasswordValidator {
  static validatePassword(password: string): ValidationResult {
    const errors: string[] = [];
    
    if (!password) {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    const strengthCheck = SecurityUtils.isStrongPassword(password);
    if (!strengthCheck.isValid) {
      errors.push(...strengthCheck.errors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

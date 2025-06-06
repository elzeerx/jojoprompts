
import { SecurityUtils } from '../../security';
import { ValidationResult } from './ValidationTypes';

export class UUIDValidator {
  static validateUUID(uuid: string, fieldName: string = 'ID'): ValidationResult {
    const errors: string[] = [];

    if (!uuid) {
      errors.push(`${fieldName} is required`);
      return { isValid: false, errors };
    }

    if (!SecurityUtils.isValidUUID(uuid)) {
      errors.push(`Invalid ${fieldName} format`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: uuid
    };
  }
}

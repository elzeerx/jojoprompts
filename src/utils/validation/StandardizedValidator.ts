
import { EmailValidator } from './core/EmailValidator';
import { PasswordValidator } from './core/PasswordValidator';
import { TextValidator } from './core/TextValidator';
import { UUIDValidator } from './core/UUIDValidator';
import { NumberValidator } from './core/NumberValidator';
import { FileValidator } from './core/FileValidator';
import { ValidationResult, ValidationRule } from './core/ValidationTypes';

// Main validator class that orchestrates all validation types
export class StandardizedValidator {
  // Email validation with consistent rules
  static validateEmail(email: string): ValidationResult {
    return EmailValidator.validateEmail(email);
  }

  // Password validation with consistent rules
  static validatePassword(password: string): ValidationResult {
    return PasswordValidator.validatePassword(password);
  }

  // Text input validation
  static validateText(
    input: string, 
    fieldName: string, 
    options: any = {}
  ): ValidationResult {
    return TextValidator.validateText(input, fieldName, options);
  }

  // UUID validation
  static validateUUID(uuid: string, fieldName: string = 'ID'): ValidationResult {
    return UUIDValidator.validateUUID(uuid, fieldName);
  }

  // Numeric validation
  static validateNumber(
    value: any, 
    fieldName: string,
    options: any = {}
  ): ValidationResult {
    return NumberValidator.validateNumber(value, fieldName, options);
  }

  // File validation
  static validateFile(
    file: File,
    options: any
  ): ValidationResult {
    return FileValidator.validateFile(file, options);
  }

  // Batch validation for forms
  static validateForm(data: Record<string, any>, rules: Record<string, ValidationRule>): {
    isValid: boolean;
    errors: Record<string, string[]>;
    sanitizedData: Record<string, any>;
  } {
    const errors: Record<string, string[]> = {};
    const sanitizedData: Record<string, any> = {};
    let isValid = true;

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      let result: ValidationResult;

      switch (rule.type) {
        case 'email':
          result = this.validateEmail(value);
          break;
        case 'password':
          result = this.validatePassword(value);
          break;
        case 'text':
          result = this.validateText(value, rule.fieldName || field, rule.options || {});
          break;
        case 'uuid':
          result = this.validateUUID(value, rule.fieldName || field);
          break;
        case 'number':
          result = this.validateNumber(value, rule.fieldName || field, rule.options || {});
          break;
        case 'file':
          result = this.validateFile(value, rule.options || { allowedTypes: [], maxSizeMB: 5 });
          break;
        default:
          result = { isValid: true, errors: [], sanitizedValue: value };
      }

      if (!result.isValid) {
        errors[field] = result.errors;
        isValid = false;
      }

      if (result.sanitizedValue !== undefined) {
        sanitizedData[field] = result.sanitizedValue;
      }
    }

    return { isValid, errors, sanitizedData };
  }
}

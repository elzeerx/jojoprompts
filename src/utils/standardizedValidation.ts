
import { SecurityUtils } from './security';
import { InputValidator } from './inputValidation';

// Standardized validation interface
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

export class StandardizedValidator {
  // Email validation with consistent rules
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

  // Password validation with consistent rules
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

  // Text input validation
  static validateText(
    input: string, 
    fieldName: string, 
    options: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      allowedChars?: RegExp;
    } = {}
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

  // UUID validation
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

  // Numeric validation
  static validateNumber(
    value: any, 
    fieldName: string,
    options: {
      required?: boolean;
      min?: number;
      max?: number;
      integer?: boolean;
    } = {}
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

  // File validation
  static validateFile(
    file: File,
    options: {
      allowedTypes: string[];
      maxSizeMB: number;
      required?: boolean;
    }
  ): ValidationResult {
    const errors: string[] = [];
    const { allowedTypes, maxSizeMB, required = true } = options;

    if (!file && required) {
      errors.push('File is required');
      return { isValid: false, errors };
    }

    if (file) {
      const validation = SecurityUtils.validateFileUpload(file, allowedTypes, maxSizeMB);
      if (!validation.isValid && validation.error) {
        errors.push(validation.error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: file
    };
  }

  // Batch validation for forms
  static validateForm(data: Record<string, any>, rules: Record<string, any>): {
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

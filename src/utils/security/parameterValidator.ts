
// Enhanced Parameter Validation for Edge Functions
import { InputValidator } from '../inputValidation';
import { SecurityUtils } from '../security';
import { logError, logWarn } from '../secureLogging';

interface ValidationRule {
  required?: boolean;
  type: 'string' | 'number' | 'boolean' | 'uuid' | 'email' | 'url';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  allowedValues?: string[];
  sanitize?: boolean;
}

interface ValidationSchema {
  [key: string]: ValidationRule;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData: Record<string, any>;
}

export class ParameterValidator {
  // Validate request parameters against schema
  static validateParameters(
    data: Record<string, any>,
    schema: ValidationSchema
  ): ValidationResult {
    const errors: string[] = [];
    const sanitizedData: Record<string, any> = {};

    try {
      // Validate each field in schema
      for (const [fieldName, rule] of Object.entries(schema)) {
        const value = data[fieldName];
        
        // Check required fields
        if (rule.required && (value === undefined || value === null || value === '')) {
          errors.push(`Field '${fieldName}' is required`);
          continue;
        }

        // Skip validation for optional empty fields
        if (!rule.required && (value === undefined || value === null || value === '')) {
          continue;
        }

        // Validate field
        const fieldResult = this.validateField(fieldName, value, rule);
        if (!fieldResult.isValid) {
          errors.push(...fieldResult.errors);
        } else {
          sanitizedData[fieldName] = fieldResult.sanitizedValue;
        }
      }

      // Check for unexpected fields
      for (const fieldName of Object.keys(data)) {
        if (!schema[fieldName]) {
          logWarn('Unexpected field in request', 'parameter_validation', { fieldName });
          errors.push(`Unexpected field '${fieldName}'`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedData
      };

    } catch (error) {
      logError('Parameter validation error', 'parameter_validation', { error: String(error) });
      return {
        isValid: false,
        errors: ['Parameter validation failed'],
        sanitizedData: {}
      };
    }
  }

  // Validate individual field
  private static validateField(
    fieldName: string,
    value: any,
    rule: ValidationRule
  ): { isValid: boolean; errors: string[]; sanitizedValue: any } {
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
          if (SecurityUtils.containsXSS(value) || SecurityUtils.containsSQLInjection(value)) {
            errors.push(`Field '${fieldName}' contains invalid content`);
          }

          // Sanitization
          if (rule.sanitize && errors.length === 0) {
            sanitizedValue = SecurityUtils.sanitizeUserInput(value);
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
          if (!InputValidator.validateUUID(value)) {
            errors.push(`Field '${fieldName}' must be a valid UUID`);
          }
          break;

        case 'email':
          const emailValidation = InputValidator.validateEmail(value);
          if (!emailValidation.isValid) {
            errors.push(`Field '${fieldName}': ${emailValidation.error}`);
          }
          break;

        case 'url':
          const urlValidation = InputValidator.validateURL(value);
          if (!urlValidation.isValid) {
            errors.push(`Field '${fieldName}': ${urlValidation.error}`);
          }
          break;

        default:
          errors.push(`Unknown validation type for field '${fieldName}'`);
      }

    } catch (error) {
      logError(`Field validation error for ${fieldName}`, 'parameter_validation', { error: String(error) });
      errors.push(`Validation failed for field '${fieldName}'`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue
    };
  }

  // Common validation schemas
  static readonly SCHEMAS = {
    PAYMENT_REQUEST: {
      userId: { required: true, type: 'uuid' as const },
      planId: { required: true, type: 'uuid' as const },
      amount: { required: true, type: 'number' as const },
      paymentMethod: { 
        required: true, 
        type: 'string' as const, 
        allowedValues: ['paypal', 'stripe', 'admin_assigned'],
        maxLength: 50
      }
    },
    USER_UPDATE: {
      userId: { required: true, type: 'uuid' as const },
      email: { required: false, type: 'email' as const },
      firstName: { 
        required: false, 
        type: 'string' as const, 
        minLength: 2, 
        maxLength: 50, 
        sanitize: true 
      },
      lastName: { 
        required: false, 
        type: 'string' as const, 
        minLength: 2, 
        maxLength: 50, 
        sanitize: true 
      },
      role: { 
        required: false, 
        type: 'string' as const, 
        allowedValues: ['user', 'admin', 'jadmin', 'prompter'] 
      }
    },
    ADMIN_ACTION: {
      action: { 
        required: true, 
        type: 'string' as const, 
        allowedValues: ['list', 'create', 'update', 'delete'],
        maxLength: 20
      },
      userId: { required: false, type: 'uuid' as const },
      userData: { required: false, type: 'string' as const, maxLength: 10000 }
    }
  };
}

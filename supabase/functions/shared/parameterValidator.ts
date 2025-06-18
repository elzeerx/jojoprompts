
// Enhanced Parameter Validation for Edge Functions
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
          console.warn('Unexpected field in request:', fieldName);
          errors.push(`Unexpected field '${fieldName}'`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedData
      };

    } catch (error) {
      console.error('Parameter validation error:', error);
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
          if (this.containsSuspiciousContent(value)) {
            errors.push(`Field '${fieldName}' contains invalid content`);
          }

          // Sanitization
          if (rule.sanitize && errors.length === 0) {
            sanitizedValue = this.sanitizeString(value);
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
          if (!this.isValidUUID(value)) {
            errors.push(`Field '${fieldName}' must be a valid UUID`);
          }
          break;

        case 'email':
          if (!this.isValidEmail(value)) {
            errors.push(`Field '${fieldName}' must be a valid email`);
          }
          break;

        case 'url':
          if (!this.isValidURL(value)) {
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

  // Helper validation methods
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return typeof uuid === 'string' && uuidRegex.test(uuid);
  }

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return typeof email === 'string' && emailRegex.test(email) && email.length <= 320;
  }

  static isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private static containsSuspiciousContent(input: string): boolean {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
      /vbscript:/i,
      /(union|select|insert|delete|update|drop|create|alter)\s+/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  private static sanitizeString(input: string): string {
    return input
      .replace(/[<>'"&]/g, (char) => {
        const entities: { [key: string]: string } = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return entities[char] || char;
      })
      .trim();
  }

  // Common validation schemas
  static readonly SCHEMAS = {
    USER_CREATE: {
      email: { required: true, type: 'email' as const },
      firstName: { 
        required: true, 
        type: 'string' as const, 
        minLength: 2, 
        maxLength: 50, 
        sanitize: true 
      },
      lastName: { 
        required: true, 
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
    }
  };
}

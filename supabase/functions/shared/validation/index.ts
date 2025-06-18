
// Main parameter validator with simplified interface
import { ValidationSchema, ValidationResult } from './types.ts';
import { FieldValidator } from './fieldValidator.ts';
import { ValidationSchemas } from './schemas.ts';

export class ParameterValidator {
  // Main validation method
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
        const fieldResult = FieldValidator.validateField(fieldName, value, rule);
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

  // Expose common schemas
  static readonly SCHEMAS = ValidationSchemas;
}

// Export all types and classes
export * from './types.ts';
export * from './validators.ts';
export * from './fieldValidator.ts';
export * from './schemas.ts';

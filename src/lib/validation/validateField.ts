import { PlatformField } from '@/types/platform';
import { ValidationResult } from './types';
import {
  validateRequired,
  validateNumberRange,
  validateStringLength,
  validatePattern,
  validateEmail,
  validateURL,
  validateJson,
  validateOptions
} from './validators';

/**
 * Main validation function that orchestrates all validators intelligently
 * based on field type and configuration
 */
export function validateField(value: any, field: PlatformField): ValidationResult {
  const allErrors: string[] = [];
  
  // 1. Check required first
  const requiredResult = validateRequired(value, field);
  if (!requiredResult.isValid) {
    return requiredResult; // If required fails, don't check other validations
  }
  
  // Skip other validations if value is empty (but not required)
  if (value === null || value === undefined || value === '') {
    return { isValid: true, errors: [] };
  }
  
  // 2. Type-specific validations based on field_type
  switch (field.field_type) {
    case 'number':
    case 'slider':
      const numberResult = validateNumberRange(value, field);
      allErrors.push(...numberResult.errors);
      break;
    
    case 'text':
    case 'textarea':
      const lengthResult = validateStringLength(value, field);
      allErrors.push(...lengthResult.errors);
      
      // Check pattern if provided
      if (field.validation_rules?.pattern) {
        const patternResult = validatePattern(value, field);
        allErrors.push(...patternResult.errors);
      }
      break;
    
    case 'code':
      // Code fields: check length and JSON if applicable
      const codeResult = validateStringLength(value, field);
      allErrors.push(...codeResult.errors);
      
      const jsonResult = validateJson(value, field);
      allErrors.push(...jsonResult.errors);
      break;
    
    case 'select':
      // Select fields: validate against options
      const optionsResult = validateOptions(value, field);
      allErrors.push(...optionsResult.errors);
      break;
    
    case 'toggle':
      // Toggle fields don't need additional validation beyond required
      break;
  }
  
  // 3. Special validators based on field_key naming conventions
  if (field.field_key.toLowerCase().includes('email')) {
    const emailResult = validateEmail(value, field);
    allErrors.push(...emailResult.errors);
  }
  
  if (field.field_key.toLowerCase().includes('url') || 
      field.field_key.toLowerCase().includes('link')) {
    const urlResult = validateURL(value, field);
    allErrors.push(...urlResult.errors);
  }
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
}

/**
 * Validates multiple fields at once
 */
export function validateFields(
  values: Record<string, any>,
  fields: PlatformField[]
): Record<string, ValidationResult> {
  const results: Record<string, ValidationResult> = {};

  for (const field of fields) {
    const value = values[field.field_key];
    results[field.field_key] = validateField(value, field);
  }

  return results;
}

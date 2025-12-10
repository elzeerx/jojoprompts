import { PlatformField } from '@/types/platform';
import { ValidationResult } from './types';
import { createLogger } from '@/utils/logging';

const logger = createLogger('validators');

/**
 * Validates a required field
 */
export function validateRequired(value: any, field: PlatformField): ValidationResult {
  if (!field.is_required) {
    return { isValid: true, errors: [] };
  }

  const isEmpty = value === null || 
                  value === undefined || 
                  value === '' || 
                  (Array.isArray(value) && value.length === 0);

  if (isEmpty) {
    return {
      isValid: false,
      errors: [`${field.label} is required`]
    };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validates number range (min/max)
 */
export function validateNumberRange(value: any, field: PlatformField): ValidationResult {
  const errors: string[] = [];
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (value === null || value === undefined || value === '') {
    return { isValid: true, errors: [] }; // Skip if empty (required validator handles this)
  }
  
  if (isNaN(numValue)) {
    errors.push(`${field.label} must be a valid number`);
    return { isValid: false, errors };
  }
  
  const rules = field.validation_rules;
  if (!rules) return { isValid: true, errors: [] };
  
  if (rules.min !== undefined && numValue < rules.min) {
    errors.push(`${field.label} must be at least ${rules.min}`);
  }
  
  if (rules.max !== undefined && numValue > rules.max) {
    errors.push(`${field.label} must be at most ${rules.max}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates string length (minLength/maxLength)
 */
export function validateStringLength(value: any, field: PlatformField): ValidationResult {
  const errors: string[] = [];
  const strValue = String(value || '');
  
  if (!value) {
    return { isValid: true, errors: [] }; // Skip if empty
  }
  
  const rules = field.validation_rules;
  if (!rules) return { isValid: true, errors: [] };
  
  if (rules.minLength !== undefined && strValue.length < rules.minLength) {
    errors.push(`${field.label} must be at least ${rules.minLength} characters`);
  }
  
  if (rules.maxLength !== undefined && strValue.length > rules.maxLength) {
    errors.push(`${field.label} must be at most ${rules.maxLength} characters`);
  }
  
  // For backward compatibility, also check 'max' for string length
  if (rules.max !== undefined && strValue.length > rules.max) {
    errors.push(`${field.label} must be at most ${rules.max} characters`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates regex pattern
 */
export function validatePattern(value: any, field: PlatformField): ValidationResult {
  const strValue = String(value || '');
  
  if (!value || !field.validation_rules?.pattern) {
    return { isValid: true, errors: [] };
  }
  
  try {
    const regex = new RegExp(field.validation_rules.pattern);
    const isValid = regex.test(strValue);
    
    return {
      isValid,
      errors: isValid ? [] : [`${field.label} format is invalid`]
    };
  } catch (error) {
    logger.warn('Invalid regex pattern', { pattern: field.validation_rules.pattern, fieldLabel: field.label });
    return { isValid: true, errors: [] }; // Don't fail on invalid regex
  }
}

/**
 * Validates email format
 */
export function validateEmail(value: any, field: PlatformField): ValidationResult {
  const strValue = String(value || '');
  
  if (!value) {
    return { isValid: true, errors: [] };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(strValue);
  
  return {
    isValid,
    errors: isValid ? [] : [`${field.label} must be a valid email address`]
  };
}

/**
 * Validates URL format
 */
export function validateURL(value: any, field: PlatformField): ValidationResult {
  const strValue = String(value || '');
  
  if (!value) {
    return { isValid: true, errors: [] };
  }
  
  try {
    new URL(strValue);
    return { isValid: true, errors: [] };
  } catch {
    return {
      isValid: false,
      errors: [`${field.label} must be a valid URL`]
    };
  }
}

/**
 * Validates JSON format for code fields
 */
export function validateJson(value: any, field: PlatformField): ValidationResult {
  // Only validate JSON for code fields with JSON placeholder/help text
  if (field.field_type !== 'code') {
    return { isValid: true, errors: [] };
  }

  const shouldValidateJson = 
    field.placeholder?.toLowerCase().includes('json') ||
    field.help_text?.toLowerCase().includes('json');

  if (!shouldValidateJson || value === null || value === undefined || value === '') {
    return { isValid: true, errors: [] };
  }

  try {
    JSON.parse(String(value));
    return { isValid: true, errors: [] };
  } catch (error) {
    return {
      isValid: false,
      errors: [`${field.label} must be valid JSON`]
    };
  }
}

/**
 * Validates that options are selected for select/dropdown fields
 */
export function validateOptions(value: any, field: PlatformField): ValidationResult {
  if (field.field_type !== 'select' || !field.options || field.options.length === 0) {
    return { isValid: true, errors: [] };
  }

  if (value === null || value === undefined || value === '') {
    return { isValid: true, errors: [] };
  }

  const validValues = field.options.map(opt => opt.value);
  
  if (!validValues.includes(String(value))) {
    return {
      isValid: false,
      errors: [`${field.label} has an invalid selection`]
    };
  }

  return { isValid: true, errors: [] };
}


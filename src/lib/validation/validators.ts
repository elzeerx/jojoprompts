import { PlatformField } from '@/types/platform';
import { ValidationResult } from './types';

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
 * Validates minimum value for numbers
 */
export function validateMin(value: any, field: PlatformField): ValidationResult {
  const min = field.validation_rules?.min;
  
  if (min === undefined || value === null || value === undefined || value === '') {
    return { isValid: true, errors: [] };
  }

  const numValue = typeof value === 'number' ? value : parseFloat(value);
  
  if (isNaN(numValue) || numValue < min) {
    return {
      isValid: false,
      errors: [`${field.label} must be at least ${min}`]
    };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validates maximum value for numbers
 */
export function validateMax(value: any, field: PlatformField): ValidationResult {
  const max = field.validation_rules?.max;
  
  if (max === undefined || value === null || value === undefined || value === '') {
    return { isValid: true, errors: [] };
  }

  const numValue = typeof value === 'number' ? value : parseFloat(value);
  
  if (isNaN(numValue) || numValue > max) {
    return {
      isValid: false,
      errors: [`${field.label} must be at most ${max}`]
    };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validates minimum length for strings
 */
export function validateMinLength(value: any, field: PlatformField): ValidationResult {
  const minLength = field.validation_rules?.minLength;
  
  if (minLength === undefined || value === null || value === undefined) {
    return { isValid: true, errors: [] };
  }

  const strValue = String(value);
  
  if (strValue.length < minLength) {
    return {
      isValid: false,
      errors: [`${field.label} must be at least ${minLength} characters`]
    };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validates maximum length for strings
 */
export function validateMaxLength(value: any, field: PlatformField): ValidationResult {
  const maxLength = field.validation_rules?.max;
  
  if (maxLength === undefined || value === null || value === undefined) {
    return { isValid: true, errors: [] };
  }

  const strValue = String(value);
  
  if (strValue.length > maxLength) {
    return {
      isValid: false,
      errors: [`${field.label} must be at most ${maxLength} characters`]
    };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validates regex pattern
 */
export function validatePattern(value: any, field: PlatformField): ValidationResult {
  const pattern = field.validation_rules?.pattern;
  
  if (!pattern || value === null || value === undefined || value === '') {
    return { isValid: true, errors: [] };
  }

  const regex = new RegExp(pattern);
  const strValue = String(value);
  
  if (!regex.test(strValue)) {
    return {
      isValid: false,
      errors: [`${field.label} format is invalid`]
    };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validates email format
 */
export function validateEmail(value: any, field: PlatformField): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return { isValid: true, errors: [] };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const strValue = String(value);
  
  if (!emailRegex.test(strValue)) {
    return {
      isValid: false,
      errors: [`${field.label} must be a valid email address`]
    };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validates URL format
 */
export function validateUrl(value: any, field: PlatformField): ValidationResult {
  if (value === null || value === undefined || value === '') {
    return { isValid: true, errors: [] };
  }

  try {
    new URL(String(value));
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

/**
 * Main validation function that runs all applicable validators
 */
export function validateField(value: any, field: PlatformField): ValidationResult {
  const errors: string[] = [];

  // Run validators in order
  const validators = [
    validateRequired,
    validateMin,
    validateMax,
    validateMinLength,
    validateMaxLength,
    validatePattern,
    validateEmail,
    validateUrl,
    validateJson,
    validateOptions
  ];

  for (const validator of validators) {
    const result = validator(value, field);
    if (!result.isValid) {
      errors.push(...result.errors);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
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

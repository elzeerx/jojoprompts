/**
 * Enhanced form validation hook with proper TypeScript support
 * Replaces scattered validation logic throughout components
 */

import { useState, useCallback, useMemo } from 'react';
interface ValidationResult { isValid: boolean; errors: Record<string, string>; }
interface FormField<T = any> { name: string; value: T; error?: string; touched: boolean; required?: boolean; }
import { logger } from '@/utils/logger';

export interface ValidationRule<T = any> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: T) => string | null;
  message?: string;
}

export interface FieldConfig<T = any> {
  name: string;
  initialValue: T;
  rules?: ValidationRule<T>;
}

export interface FormConfig {
  fields: FieldConfig[];
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export function useFormValidation<T extends Record<string, any>>(config: FormConfig) {
  const [fields, setFields] = useState<Record<string, FormField>>(() => {
    const initialFields: Record<string, FormField> = {};
    config.fields.forEach(field => {
      initialFields[field.name] = {
        name: field.name,
        value: field.initialValue,
        error: undefined,
        touched: false,
        required: field.rules?.required || false
      };
    });
    return initialFields;
  });

  const validateField = useCallback((name: string, value: any, rules?: ValidationRule): string | null => {
    if (!rules) return null;

    // Required validation
    if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return rules.message || `${name} is required`;
    }

    // Skip other validations if field is empty and not required
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null;
    }

    // String length validations
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        return rules.message || `${name} must be at least ${rules.minLength} characters`;
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        return rules.message || `${name} must be no more than ${rules.maxLength} characters`;
      }
    }

    // Pattern validation
    if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
      return rules.message || `${name} format is invalid`;
    }

    // Custom validation
    if (rules.custom) {
      return rules.custom(value);
    }

    return null;
  }, []);

  const validateAllFields = useCallback((): ValidationResult => {
    const errors: Record<string, string> = {};
    let isValid = true;

    config.fields.forEach(fieldConfig => {
      const field = fields[fieldConfig.name];
      const error = validateField(fieldConfig.name, field.value, fieldConfig.rules);
      
      if (error) {
        errors[fieldConfig.name] = error;
        isValid = false;
      }
    });

    logger.debug('Form validation completed', 'FORM_VALIDATION', { 
      isValid, 
      errors: Object.keys(errors) 
    });

    return { isValid, errors };
  }, [fields, config.fields, validateField]);

  const updateField = useCallback((name: string, value: any, shouldValidate = config.validateOnChange) => {
    setFields(prev => {
      const fieldConfig = config.fields.find(f => f.name === name);
      const error = shouldValidate && fieldConfig
        ? validateField(name, value, fieldConfig.rules)
        : prev[name]?.error;

      return {
        ...prev,
        [name]: {
          ...prev[name],
          value,
          error: error || undefined,
          touched: true
        }
      };
    });
  }, [config.fields, config.validateOnChange, validateField]);

  const setFieldError = useCallback((name: string, error: string) => {
    setFields(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        error
      }
    }));
  }, []);

  const clearFieldError = useCallback((name: string) => {
    setFields(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        error: undefined
      }
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFields(() => {
      const resetFields: Record<string, FormField> = {};
      config.fields.forEach(field => {
        resetFields[field.name] = {
          name: field.name,
          value: field.initialValue,
          error: undefined,
          touched: false,
          required: field.rules?.required || false
        };
      });
      return resetFields;
    });
  }, [config.fields]);

  const getFieldProps = useCallback((name: string) => {
    const field = fields[name];
    const fieldConfig = config.fields.find(f => f.name === name);
    
    return {
      name,
      value: field?.value || '',
      error: field?.error,
      required: field?.required || false,
      onChange: (value: any) => updateField(name, value),
      onBlur: () => {
        if (config.validateOnBlur && fieldConfig) {
          const error = validateField(name, field?.value, fieldConfig.rules);
          if (error) {
            setFieldError(name, error);
          }
        }
      }
    };
  }, [fields, config.fields, config.validateOnBlur, updateField, validateField, setFieldError]);

  const formValues = useMemo(() => {
    const values: Record<string, any> = {};
    Object.keys(fields).forEach(name => {
      values[name] = fields[name].value;
    });
    return values as T;
  }, [fields]);

  const hasErrors = useMemo(() => {
    return Object.values(fields).some(field => field.error);
  }, [fields]);

  const isDirty = useMemo(() => {
    return Object.values(fields).some(field => field.touched);
  }, [fields]);

  return {
    fields,
    formValues,
    hasErrors,
    isDirty,
    validateAllFields,
    updateField,
    setFieldError,
    clearFieldError,
    resetForm,
    getFieldProps
  };
}

// Common validation rules
export const validationRules = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Please enter a valid email address'
  },
  
  password: {
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    message: 'Password must be at least 8 characters with uppercase, lowercase, and number'
  },
  
  username: {
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
    message: 'Username can only contain letters, numbers, and underscores'
  },
  
  required: {
    required: true,
    message: 'This field is required'
  },
  
  url: {
    pattern: /^https?:\/\/.+/,
    message: 'Please enter a valid URL'
  }
};
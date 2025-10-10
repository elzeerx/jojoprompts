import { useState, useCallback, useMemo } from 'react';
import { PlatformField } from '@/types/platform';
import { validateField, validateFields } from './validators';
import { FieldValidationResult, FormValidationState, ValidationOptions } from './types';

/**
 * Hook for validating form fields based on platform field configurations
 */
export function useFieldValidation(
  fields: PlatformField[],
  options: ValidationOptions = {}
) {
  const [errors, setErrors] = useState<FieldValidationResult>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);

  const {
    validateOnBlur = true,
    validateOnChange = false,
    stopOnFirstError = false
  } = options;

  /**
   * Validates a single field value
   */
  const validateSingleField = useCallback((fieldKey: string, value: any): boolean => {
    const field = fields.find(f => f.field_key === fieldKey);
    if (!field) return true;

    const result = validateField(value, field);
    
    setErrors(prev => ({
      ...prev,
      [fieldKey]: result
    }));

    return result.isValid;
  }, [fields]);

  /**
   * Validates all fields
   */
  const validateAllFields = useCallback((values: Record<string, any>): boolean => {
    const results = validateFields(values, fields);
    setErrors(results);
    return Object.values(results).every(r => r.isValid);
  }, [fields]);

  /**
   * Marks a field as touched
   */
  const touchField = useCallback((fieldKey: string) => {
    setTouchedFields(prev => new Set(prev).add(fieldKey));
    setIsDirty(true);
  }, []);

  /**
   * Handles blur event for a field
   */
  const handleBlur = useCallback((fieldKey: string, value: any) => {
    touchField(fieldKey);
    if (validateOnBlur) {
      validateSingleField(fieldKey, value);
    }
  }, [touchField, validateOnBlur, validateSingleField]);

  /**
   * Handles change event for a field
   */
  const handleChange = useCallback((fieldKey: string, value: any) => {
    setIsDirty(true);
    if (validateOnChange) {
      validateSingleField(fieldKey, value);
    }
  }, [validateOnChange, validateSingleField]);

  /**
   * Clears all validation errors
   */
  const clearErrors = useCallback(() => {
    setErrors({});
    setTouchedFields(new Set());
    setIsDirty(false);
  }, []);

  /**
   * Clears error for a specific field
   */
  const clearFieldError = useCallback((fieldKey: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldKey];
      return newErrors;
    });
  }, []);

  /**
   * Gets error for a specific field (only if touched)
   */
  const getFieldError = useCallback((fieldKey: string): string | string[] | undefined => {
    if (!touchedFields.has(fieldKey)) return undefined;
    const result = errors[fieldKey];
    if (!result || result.isValid) return undefined;
    return result.errors.length === 1 ? result.errors[0] : result.errors;
  }, [errors, touchedFields]);

  /**
   * Checks if form is valid
   */
  const isValid = useMemo(() => {
    return Object.values(errors).every(r => r.isValid);
  }, [errors]);

  /**
   * Gets current validation state
   */
  const validationState: FormValidationState = useMemo(() => ({
    errors,
    isValid,
    isDirty,
    touchedFields
  }), [errors, isValid, isDirty, touchedFields]);

  return {
    errors,
    isValid,
    isDirty,
    touchedFields,
    validationState,
    validateSingleField,
    validateAllFields,
    touchField,
    handleBlur,
    handleChange,
    clearErrors,
    clearFieldError,
    getFieldError
  };
}

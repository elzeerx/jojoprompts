import { useState, useCallback } from 'react';
import { PlatformField } from '@/types/platform';
import { FieldValidationResult } from '@/lib/validation/types';
import { validateField } from '@/lib/validation/validateField';
import { validateForm, hasFormErrors, getFieldError } from '@/lib/validation/validateForm';

/**
 * React hook for real-time field validation
 * Simpler API compared to the advanced useFieldValidation in lib/validation
 */
export function useFieldValidation(fields: PlatformField[]) {
  const [validationResults, setValidationResults] = useState<FieldValidationResult>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  /**
   * Validates all fields at once
   */
  const validateAll = useCallback((values: Record<string, any>) => {
    const results = validateForm(values, fields);
    setValidationResults(results);
    return !hasFormErrors(results);
  }, [fields]);

  /**
   * Validates a single field
   */
  const validateSingle = useCallback((fieldKey: string, value: any) => {
    const field = fields.find(f => f.field_key === fieldKey);
    if (!field) return true;

    const result = validateField(value, field);
    setValidationResults(prev => ({
      ...prev,
      [fieldKey]: result
    }));

    return result.isValid;
  }, [fields]);

  /**
   * Marks a field as touched (for showing errors only after interaction)
   */
  const touchField = useCallback((fieldKey: string) => {
    setTouched(prev => ({ ...prev, [fieldKey]: true }));
  }, []);

  /**
   * Gets error for a specific field (only if touched)
   */
  const getError = useCallback((fieldKey: string) => {
    if (!touched[fieldKey]) return undefined;
    return getFieldError(validationResults, fieldKey);
  }, [validationResults, touched]);

  /**
   * Checks if form has any errors
   */
  const hasErrors = useCallback(() => {
    return hasFormErrors(validationResults);
  }, [validationResults]);

  /**
   * Clears all validation state
   */
  const clearValidation = useCallback(() => {
    setValidationResults({});
    setTouched({});
  }, []);

  return {
    validateAll,
    validateSingle,
    touchField,
    getError,
    hasErrors,
    validationResults,
    clearValidation,
    touched
  };
}

import { useState, useCallback } from 'react';
import { PlatformField } from '@/types/platform';
import { useFieldValidation } from './useFieldValidation';
import { createLogger } from '@/utils/logging';

const logger = createLogger('DYNAMIC_FORM');

export interface UseDynamicFormOptions {
  fields: PlatformField[];
  initialValues?: Record<string, any>;
  onSubmit?: (values: Record<string, any>) => void | Promise<void>;
}

/**
 * useDynamicForm - Complete form management hook with validation
 * 
 * Handles form state, validation, submission, and resets for dynamic forms.
 * Automatically parses default values based on field types.
 * 
 * @example
 * ```tsx
 * const form = useDynamicForm({
 *   fields: platformFields,
 *   initialValues: { name: 'John' },
 *   onSubmit: async (values) => {
 *     await saveToDatabase(values);
 *   }
 * });
 * 
 * return (
 *   <form onSubmit={form.handleSubmit}>
 *     <DynamicFieldGroup
 *       fields={fields}
 *       values={form.values}
 *       onChange={form.setValue}
 *       errors={...}
 *       onBlur={form.handleBlur}
 *     />
 *     <button disabled={form.isSubmitting}>Submit</button>
 *   </form>
 * );
 * ```
 */
export function useDynamicForm({
  fields,
  initialValues = {},
  onSubmit
}: UseDynamicFormOptions) {
  
  /**
   * Initialize form values with defaults from field configurations
   */
  const getInitialValues = useCallback(() => {
    const values: Record<string, any> = { ...initialValues };
    
    fields.forEach(field => {
      if (values[field.field_key] === undefined && field.default_value) {
        // Parse default value based on field type
        if (field.field_type === 'number' || field.field_type === 'slider') {
          values[field.field_key] = parseFloat(field.default_value);
        } else if (field.field_type === 'toggle') {
          values[field.field_key] = field.default_value === 'true';
        } else {
          values[field.field_key] = field.default_value;
        }
      }
    });
    
    return values;
  }, [fields, initialValues]);

  const [values, setValues] = useState<Record<string, any>>(getInitialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    validateAll,
    validateSingle,
    touchField,
    getError,
    hasErrors,
    clearValidation
  } = useFieldValidation(fields);

  /**
   * Update single field value
   */
  const setValue = useCallback((fieldKey: string, value: any) => {
    setValues(prev => ({
      ...prev,
      [fieldKey]: value
    }));
    
    // Validate field on change (optional, can be on blur only)
    // validateSingle(fieldKey, value);
  }, []);

  /**
   * Update multiple values at once
   */
  const setMultipleValues = useCallback((newValues: Record<string, any>) => {
    setValues(prev => ({
      ...prev,
      ...newValues
    }));
  }, []);

  /**
   * Handle field blur - triggers validation
   */
  const handleBlur = useCallback((fieldKey: string) => {
    touchField(fieldKey);
    validateSingle(fieldKey, values[fieldKey]);
  }, [values, touchField, validateSingle]);

  /**
   * Handle form submission with validation
   */
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Validate all fields
    const isValid = validateAll(values);
    
    if (!isValid) {
      // Mark all fields as touched to show errors
      fields.forEach(field => touchField(field.field_key));
      return;
    }

    if (onSubmit) {
      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } catch (error) {
        logger.error('Form submission error', { error });
      } finally{
        setIsSubmitting(false);
      }
    }
  }, [values, fields, validateAll, touchField, onSubmit]);

  /**
   * Reset form to initial values
   */
  const reset = useCallback(() => {
    setValues(getInitialValues());
    clearValidation();
    setIsSubmitting(false);
  }, [getInitialValues, clearValidation]);

  /**
   * Check if form has unsaved changes
   */
  const isDirty = useCallback(() => {
    const initial = getInitialValues();
    return JSON.stringify(values) !== JSON.stringify(initial);
  }, [values, getInitialValues]);

  return {
    // Values
    values,
    
    // Value setters
    setValue,
    setMultipleValues,
    
    // Event handlers
    handleBlur,
    handleSubmit,
    
    // Form actions
    reset,
    
    // Form state
    isSubmitting,
    hasErrors: hasErrors(),
    isDirty: isDirty(),
    
    // Validation
    getError,
    validateAll: () => validateAll(values),
    validateSingle: (fieldKey: string) => validateSingle(fieldKey, values[fieldKey])
  };
}

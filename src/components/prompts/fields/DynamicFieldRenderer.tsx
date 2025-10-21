import React, { memo, useCallback } from 'react';
import { PlatformField } from '@/types/platform';
import { TextField } from './TextField';
import { TextareaField } from './TextareaField';
import { NumberField } from './NumberField';
import { SelectField } from './SelectField';
import { SliderField } from './SliderField';
import { ToggleField } from './ToggleField';
import { CodeField } from './CodeField';
import { FieldComponentProps } from './types';

export interface DynamicFieldRendererProps {
  field: PlatformField;
  value: any;
  onChange: (value: any) => void;
  error?: string | string[];
  disabled?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
  allValues?: Record<string, any>; // All form values for conditional logic
  className?: string;
}

/**
 * DynamicFieldRenderer - Smart component that renders the appropriate field component
 * based on the field configuration. Handles conditional logic, validation, and all field types.
 * 
 * @example
 * ```tsx
 * <DynamicFieldRenderer
 *   field={platformField}
 *   value={formValues[field.field_key]}
 *   onChange={(val) => setFormValues({...formValues, [field.field_key]: val})}
 *   error={validationErrors[field.field_key]}
 *   allValues={formValues}
 * />
 * ```
 */
export const DynamicFieldRenderer = memo(function DynamicFieldRenderer({
  field,
  value,
  onChange,
  error,
  disabled = false,
  onBlur,
  onFocus,
  allValues = {},
  className
}: DynamicFieldRendererProps) {
  
  /**
   * Checks if field should be shown based on conditional logic
   */
  const shouldShowField = useCallback(() => {
    if (!field.conditional_logic) return true;
    
    const { field: dependentField, operator, value: expectedValue } = field.conditional_logic;
    const dependentValue = allValues[dependentField];
    
    switch (operator) {
      case 'equals':
        return dependentValue === expectedValue;
      case 'not_equals':
        return dependentValue !== expectedValue;
      case 'contains':
        return String(dependentValue || '').includes(String(expectedValue));
      case 'greater_than':
        return Number(dependentValue) > Number(expectedValue);
      case 'less_than':
        return Number(dependentValue) < Number(expectedValue);
      default:
        return true;
    }
  }, [field.conditional_logic, allValues]);

  // Don't render if conditional logic fails
  if (!shouldShowField()) {
    return null;
  }

  // Common props passed to all field components
  const commonProps: FieldComponentProps = {
    field,
    value,
    onChange,
    error,
    disabled,
    onBlur,
    onFocus,
    className
  };

  // Render appropriate field component based on field_type
  switch (field.field_type) {
    case 'text':
      return <TextField {...commonProps} />;
    
    case 'textarea':
      return <TextareaField {...commonProps} />;
    
    case 'number':
      return <NumberField {...commonProps} />;
    
    case 'select':
      return <SelectField {...commonProps} />;
    
    case 'slider':
      return <SliderField {...commonProps} />;
    
    case 'toggle':
      return <ToggleField {...commonProps} />;
    
    case 'code':
      return <CodeField {...commonProps} />;
    
    default:
      // Fallback to TextField for unknown types
      console.warn(`Unknown field type: ${field.field_type}, falling back to TextField`);
      return <TextField {...commonProps} />;
  }
});

import React from 'react';
import { PlatformField } from '@/types/platform';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { cn } from '@/lib/utils';

export interface DynamicFieldGroupProps {
  fields: PlatformField[];
  values: Record<string, any>;
  onChange: (fieldKey: string, value: any) => void;
  errors?: Record<string, string | string[]>;
  disabled?: boolean;
  onBlur?: (fieldKey: string) => void;
  layout?: 'vertical' | 'grid' | 'two-column';
  className?: string;
}

/**
 * DynamicFieldGroup - Renders multiple fields in a group with layout options
 * 
 * Automatically sorts fields by display_order and applies the specified layout.
 * Supports vertical stacking, grid layout, and two-column layout.
 * 
 * @example
 * ```tsx
 * <DynamicFieldGroup
 *   fields={platformFields}
 *   values={formValues}
 *   onChange={(key, val) => setFormValues({...formValues, [key]: val})}
 *   errors={validationErrors}
 *   layout="grid"
 * />
 * ```
 */
export function DynamicFieldGroup({
  fields,
  values,
  onChange,
  errors = {},
  disabled = false,
  onBlur,
  layout = 'vertical',
  className
}: DynamicFieldGroupProps) {
  
  // Sort fields by display_order
  const sortedFields = [...fields].sort((a, b) => a.display_order - b.display_order);

  // Layout class mapping
  const layoutClasses = {
    vertical: 'space-y-6',
    grid: 'grid grid-cols-1 md:grid-cols-2 gap-6',
    'two-column': 'grid grid-cols-1 md:grid-cols-2 gap-6'
  };

  return (
    <div className={cn(layoutClasses[layout], className)}>
      {sortedFields.map((field) => (
        <DynamicFieldRenderer
          key={field.id}
          field={field}
          value={values[field.field_key]}
          onChange={(value) => onChange(field.field_key, value)}
          error={errors[field.field_key]}
          disabled={disabled}
          onBlur={() => onBlur?.(field.field_key)}
          allValues={values}
        />
      ))}
    </div>
  );
}

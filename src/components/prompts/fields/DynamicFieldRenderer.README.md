# DynamicFieldRenderer

The DynamicFieldRenderer is the core component that intelligently renders the appropriate field component based on platform field configuration. It acts as a smart router between field configurations from the database and the UI components.

## Overview

The DynamicFieldRenderer:
- ✅ Automatically selects the correct field component based on `field_type`
- ✅ Handles conditional logic (show/hide fields)
- ✅ Manages validation and error display
- ✅ Provides a unified interface for all field types
- ✅ Performance optimized with React.memo
- ✅ Type-safe with full TypeScript support
- ✅ Gracefully handles unknown field types

## Usage

### Basic Example

```tsx
import { DynamicFieldRenderer } from '@/components/prompts/fields';
import { PlatformField } from '@/types/platform';

function MyForm({ fields }: { fields: PlatformField[] }) {
  const [values, setValues] = useState<Record<string, any>>({});
  const validation = useFieldValidation(fields);

  return (
    <form>
      {fields.map(field => (
        <DynamicFieldRenderer
          key={field.field_key}
          field={field}
          value={values[field.field_key]}
          onChange={(val) => setValues({...values, [field.field_key]: val})}
          error={validation.getError(field.field_key)}
          onBlur={() => validation.touchField(field.field_key)}
          allValues={values}
        />
      ))}
    </form>
  );
}
```

### With Conditional Logic

```tsx
// Field that only shows when another field has specific value
const conditionalField: PlatformField = {
  field_key: 'advanced_options',
  field_type: 'textarea',
  label: 'Advanced Options',
  conditional_logic: {
    field: 'enable_advanced',
    operator: 'equals',
    value: true
  },
  // ... other properties
};

<DynamicFieldRenderer
  field={conditionalField}
  value={values.advanced_options}
  onChange={(val) => setValues({...values, advanced_options: val})}
  allValues={values} // Required for conditional logic
/>
```

## Props

### DynamicFieldRendererProps

```typescript
interface DynamicFieldRendererProps {
  field: PlatformField;              // Field configuration from database
  value: any;                        // Current field value
  onChange: (value: any) => void;    // Value change handler
  error?: string | string[];         // Validation error(s)
  disabled?: boolean;                // Disable field input
  onBlur?: () => void;              // Blur event handler
  onFocus?: () => void;             // Focus event handler
  allValues?: Record<string, any>;  // All form values (for conditional logic)
  className?: string;               // Additional CSS classes
}
```

## Supported Field Types

The DynamicFieldRenderer supports all field types and automatically renders the correct component:

| field_type | Component Rendered | Use Case |
|-----------|-------------------|----------|
| `text` | TextField | Single-line text input |
| `textarea` | TextareaField | Multi-line text input |
| `number` | NumberField | Numeric input with validation |
| `select` | SelectField | Dropdown selection |
| `slider` | SliderField | Range slider input |
| `toggle` | ToggleField | Boolean on/off switch |
| `code` | CodeField | Code/JSON editor |
| *unknown* | TextField (fallback) | Any unrecognized type |

## Conditional Logic

The DynamicFieldRenderer supports conditional rendering based on other field values.

### Conditional Logic Configuration

```typescript
interface ConditionalLogic {
  field: string;           // Field key to check
  operator: string;        // Comparison operator
  value: any;             // Expected value
}
```

### Supported Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Value must equal | `temperature === 1.0` |
| `not_equals` | Value must not equal | `model !== 'gpt-4'` |
| `contains` | String contains value | `prompt.includes('creative')` |
| `greater_than` | Numeric greater than | `tokens > 1000` |
| `less_than` | Numeric less than | `temperature < 0.5` |

### Example Configurations

```typescript
// Show field only when checkbox is checked
{
  conditional_logic: {
    field: 'enable_feature',
    operator: 'equals',
    value: true
  }
}

// Show field when model is NOT GPT-4
{
  conditional_logic: {
    field: 'model',
    operator: 'not_equals',
    value: 'gpt-4'
  }
}

// Show field when temperature is high
{
  conditional_logic: {
    field: 'temperature',
    operator: 'greater_than',
    value: 0.7
  }
}
```

## Field Configuration Examples

### Text Field

```typescript
const textField: PlatformField = {
  id: 'field-1',
  platform_id: 'chatgpt',
  field_key: 'system_message',
  field_type: 'text',
  label: 'System Message',
  placeholder: 'You are a helpful assistant...',
  is_required: true,
  help_text: 'Sets the behavior of the AI',
  validation_rules: { maxLength: 500 },
  display_order: 0,
  created_at: '2024-01-01',
  updated_at: '2024-01-01'
};
```

### Select Field

```typescript
const selectField: PlatformField = {
  id: 'field-2',
  platform_id: 'chatgpt',
  field_key: 'model',
  field_type: 'select',
  label: 'Model',
  is_required: true,
  options: [
    { label: 'GPT-4', value: 'gpt-4' },
    { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
    { label: 'GPT-3.5', value: 'gpt-3.5-turbo' }
  ],
  display_order: 1,
  created_at: '2024-01-01',
  updated_at: '2024-01-01'
};
```

### Slider Field

```typescript
const sliderField: PlatformField = {
  id: 'field-3',
  platform_id: 'chatgpt',
  field_key: 'temperature',
  field_type: 'slider',
  label: 'Temperature',
  help_text: 'Controls randomness (0 = focused, 2 = creative)',
  validation_rules: { min: 0, max: 2, step: 0.1 },
  default_value: '0.7',
  display_order: 2,
  created_at: '2024-01-01',
  updated_at: '2024-01-01'
};
```

## Integration with Validation

The DynamicFieldRenderer works seamlessly with the validation system:

```tsx
import { useFieldValidation } from '@/lib/validation';

function MyForm({ fields }: { fields: PlatformField[] }) {
  const [values, setValues] = useState({});
  const validation = useFieldValidation(fields);

  const handleSubmit = () => {
    const isValid = validation.validateAll(values);
    if (!isValid) {
      toast.error('Please fix validation errors');
      return;
    }
    // Submit form
  };

  return (
    <>
      {fields.map(field => (
        <DynamicFieldRenderer
          key={field.field_key}
          field={field}
          value={values[field.field_key]}
          onChange={(val) => {
            setValues({...values, [field.field_key]: val});
            validation.validateSingle(field.field_key, val);
          }}
          error={validation.getError(field.field_key)}
          onBlur={() => validation.touchField(field.field_key)}
          allValues={values}
        />
      ))}
      <button onClick={handleSubmit}>Submit</button>
    </>
  );
}
```

## Performance

The DynamicFieldRenderer is optimized for performance:

### Memoization

The component uses `React.memo` to prevent unnecessary re-renders:
```tsx
export const DynamicFieldRenderer = memo(function DynamicFieldRenderer(props) {
  // Component implementation
});
```

### Conditional Logic Optimization

Conditional logic checks are memoized with `useCallback`:
```tsx
const shouldShowField = useCallback(() => {
  // Conditional logic evaluation
}, [field.conditional_logic, allValues]);
```

### Best Practices

1. **Provide stable references** - Use useCallback for onChange handlers
2. **Memoize allValues** - Use useMemo for the allValues object
3. **Minimize re-renders** - Only update values that actually changed

```tsx
// Good ✅
const handleChange = useCallback((key: string, value: any) => {
  setValues(prev => ({ ...prev, [key]: value }));
}, []);

const allValues = useMemo(() => values, [values]);

// Bad ❌
const handleChange = (key: string, value: any) => {
  setValues({ ...values, [key]: value }); // Creates new object reference
};
```

## Error Handling

The DynamicFieldRenderer handles errors gracefully:

### Unknown Field Types

```typescript
default:
  console.warn(`Unknown field type: ${field.field_type}, falling back to TextField`);
  return <TextField {...commonProps} />;
```

### Validation Errors

Errors are passed through to child components:
```tsx
<DynamicFieldRenderer
  field={field}
  value={value}
  onChange={onChange}
  error="This field is required" // String error
  // OR
  error={["Too short", "Invalid format"]} // Array of errors
/>
```

## TypeScript Support

Full TypeScript support with strict typing:

```typescript
// Props are fully typed
const props: DynamicFieldRendererProps = {
  field: platformField,
  value: 'test',
  onChange: (val: any) => console.log(val),
  error: 'Error message',
  disabled: false,
  onBlur: () => {},
  onFocus: () => {},
  allValues: { key: 'value' },
  className: 'custom-class'
};

// Component enforces types
<DynamicFieldRenderer {...props} />
```

## Testing

### Example Test

```typescript
import { render, screen } from '@testing-library/react';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';

describe('DynamicFieldRenderer', () => {
  it('renders TextField for text type', () => {
    const field: PlatformField = {
      field_type: 'text',
      field_key: 'test',
      label: 'Test Field',
      // ... other required fields
    };

    render(
      <DynamicFieldRenderer
        field={field}
        value=""
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText('Test Field')).toBeInTheDocument();
  });

  it('hides field when conditional logic fails', () => {
    const field: PlatformField = {
      field_type: 'text',
      field_key: 'conditional',
      label: 'Conditional Field',
      conditional_logic: {
        field: 'enable',
        operator: 'equals',
        value: true
      },
      // ... other required fields
    };

    const { container } = render(
      <DynamicFieldRenderer
        field={field}
        value=""
        onChange={() => {}}
        allValues={{ enable: false }}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
```

## Migration Guide

### From Individual Components

**Before:**
```tsx
{field.field_type === 'text' && <TextField {...props} />}
{field.field_type === 'number' && <NumberField {...props} />}
{field.field_type === 'select' && <SelectField {...props} />}
// ... more conditions
```

**After:**
```tsx
<DynamicFieldRenderer field={field} {...props} />
```

## FAQ

### Q: When should I use DynamicFieldRenderer vs individual field components?

A: Use DynamicFieldRenderer when:
- Rendering fields from database configurations
- Building dynamic forms
- Need conditional logic support
- Want a single unified API

Use individual components when:
- Building static forms
- Need maximum control over rendering
- Optimizing for a specific field type

### Q: How do I add support for a new field type?

A: Add a new case in the switch statement:
```typescript
case 'my_custom_type':
  return <MyCustomField {...commonProps} />;
```

### Q: Can I customize the rendered component?

A: Yes, pass custom className or wrap in your own component:
```tsx
<div className="custom-wrapper">
  <DynamicFieldRenderer {...props} className="custom-field" />
</div>
```

### Q: How do I debug conditional logic?

A: Add console logs in shouldShowField:
```typescript
const shouldShowField = useCallback(() => {
  if (!field.conditional_logic) return true;
  
  const result = /* logic */;
  console.log('Conditional check:', { field, result, allValues });
  return result;
}, [field.conditional_logic, allValues]);
```

## Related Components

- [TextField](./TextField.tsx) - Single-line text input
- [TextareaField](./TextareaField.tsx) - Multi-line text input
- [NumberField](./NumberField.tsx) - Numeric input
- [SelectField](./SelectField.tsx) - Dropdown selection
- [SliderField](./SliderField.tsx) - Range slider
- [ToggleField](./ToggleField.tsx) - Boolean toggle
- [CodeField](./CodeField.tsx) - Code editor

## See Also

- [Validation System](../../../lib/validation/README.md)
- [Platform Types](../../../types/platform.ts)
- [Demo Page](../../../pages/PlatformTest.tsx)

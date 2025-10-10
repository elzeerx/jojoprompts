# Dynamic Prompt Field System

Complete documentation for the dynamic field rendering system built in Phase 2 of the JojoPrompts project.

## Overview

This system provides a complete solution for rendering dynamic forms based on platform field configurations stored in the database. It consists of four main phases:

### Phase 2.1: Basic Field Components
- `TextField` - Single-line text input
- `TextareaField` - Multi-line text input with character counter
- `NumberField` - Numeric input with min/max validation

### Phase 2.2: Advanced Field Components
- `SelectField` - Dropdown selection with options
- `SliderField` - Range slider with real-time value display
- `ToggleField` - Boolean on/off switch
- `CodeField` - Code/JSON editor with formatting

### Phase 2.3: Validation System
- Individual validators for each rule type
- Form-level validation utilities
- React hooks for real-time validation
- Error formatting and display

### Phase 2.4: Orchestration Components
- `DynamicFieldRenderer` - Smart component router
- `DynamicFieldGroup` - Multi-field renderer with layouts
- `FieldSection` - Collapsible section organizer
- `ValidationErrorList` - Error display component

## Quick Start

### Simple Form with Single Field

```tsx
import { DynamicFieldRenderer } from '@/components/prompts/fields';
import { useFieldValidation } from '@/lib/validation';

function SimpleForm({ field }: { field: PlatformField }) {
  const [value, setValue] = useState('');
  const validation = useFieldValidation([field]);

  return (
    <DynamicFieldRenderer
      field={field}
      value={value}
      onChange={setValue}
      error={validation.getError(field.field_key)}
      onBlur={() => validation.touchField(field.field_key)}
    />
  );
}
```

### Multi-Field Form with Validation

```tsx
import { DynamicFieldGroup } from '@/components/prompts/fields';
import { FieldSection } from '@/components/prompts/FieldSection';
import { useFieldValidation } from '@/lib/validation';

function MultiFieldForm({ fields }: { fields: PlatformField[] }) {
  const [values, setValues] = useState<Record<string, any>>({});
  const validation = useFieldValidation(fields);

  const handleChange = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
    validation.validateSingle(key, value);
  };

  const handleSubmit = () => {
    const isValid = validation.validateAll(values);
    if (isValid) {
      // Submit form
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      <DynamicFieldGroup
        fields={fields}
        values={values}
        onChange={handleChange}
        errors={Object.fromEntries(
          Object.entries(validation.validationResults).map(([key, result]) => [
            key,
            result.isValid ? undefined : result.errors
          ])
        )}
        onBlur={(key) => validation.touchField(key)}
        layout="grid"
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Complete Form with Sections

```tsx
import { DynamicFieldGroup } from '@/components/prompts/fields';
import { FieldSection } from '@/components/prompts/FieldSection';
import { ValidationErrorList } from '@/components/prompts/ValidationErrorList';
import { useFieldValidation, getFormErrors } from '@/lib/validation';

function CompleteForm({ fields }: { fields: PlatformField[] }) {
  const [values, setValues] = useState({});
  const validation = useFieldValidation(fields);

  const basicFields = fields.filter(f => f.display_order < 10);
  const advancedFields = fields.filter(f => f.display_order >= 10);

  const handleChange = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
    validation.validateSingle(key, value);
  };

  const errors = Object.fromEntries(
    Object.entries(validation.validationResults).map(([key, result]) => [
      key,
      result.isValid ? undefined : result.errors
    ])
  );

  return (
    <div className="space-y-6">
      <FieldSection
        title="Basic Settings"
        description="Essential configuration options"
        collapsible
        defaultOpen={true}
      >
        <DynamicFieldGroup
          fields={basicFields}
          values={values}
          onChange={handleChange}
          errors={errors}
          onBlur={(key) => validation.touchField(key)}
          layout="grid"
        />
      </FieldSection>

      <FieldSection
        title="Advanced Settings"
        description="Optional advanced parameters"
        collapsible
        defaultOpen={false}
      >
        <DynamicFieldGroup
          fields={advancedFields}
          values={values}
          onChange={handleChange}
          errors={errors}
          onBlur={(key) => validation.touchField(key)}
          layout="vertical"
        />
      </FieldSection>

      <ValidationErrorList 
        errors={getFormErrors(validation.validationResults)}
      />

      <button onClick={() => validation.validateAll(values)}>
        Submit
      </button>
    </div>
  );
}
```

## Component Architecture

```
DynamicFieldRenderer (Smart Router)
├── Conditional Logic Check
├── Field Type Detection
└── Component Selection
    ├── TextField
    ├── TextareaField
    ├── NumberField
    ├── SelectField
    ├── SliderField
    ├── ToggleField
    └── CodeField

DynamicFieldGroup (Multi-Field Manager)
├── Field Sorting (by display_order)
├── Layout Application
└── Multiple DynamicFieldRenderer instances

FieldSection (Visual Organizer)
├── Section Header (with collapse/expand)
├── Description
└── Children (typically DynamicFieldGroup)
```

## Database Schema

### platform_fields Table

```sql
CREATE TABLE platform_fields (
  id UUID PRIMARY KEY,
  platform_id UUID REFERENCES platforms(id),
  field_key TEXT NOT NULL,
  field_type TEXT NOT NULL, -- 'text', 'textarea', 'number', 'select', 'slider', 'toggle', 'code'
  label TEXT NOT NULL,
  placeholder TEXT,
  help_text TEXT,
  is_required BOOLEAN DEFAULT false,
  validation_rules JSONB, -- { min, max, minLength, maxLength, pattern }
  options JSONB, -- [{ label, value }] for select fields
  default_value TEXT,
  conditional_logic JSONB, -- { field, operator, value }
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Field Configuration Examples

```typescript
// Text field with length validation
{
  field_key: 'system_message',
  field_type: 'text',
  label: 'System Message',
  is_required: true,
  validation_rules: { maxLength: 500 }
}

// Select field with options
{
  field_key: 'model',
  field_type: 'select',
  label: 'Model',
  is_required: true,
  options: [
    { label: 'GPT-4', value: 'gpt-4' },
    { label: 'GPT-3.5', value: 'gpt-3.5' }
  ]
}

// Slider field with range
{
  field_key: 'temperature',
  field_type: 'slider',
  label: 'Temperature',
  validation_rules: { min: 0, max: 2, step: 0.1 },
  default_value: '0.7'
}

// Field with conditional logic
{
  field_key: 'advanced_options',
  field_type: 'textarea',
  label: 'Advanced Options',
  conditional_logic: {
    field: 'enable_advanced',
    operator: 'equals',
    value: true
  }
}
```

## Validation System Integration

### Automatic Validation

Fields are automatically validated based on their configuration:

```typescript
// Required validation
is_required: true

// Number range
validation_rules: { min: 0, max: 100 }

// String length
validation_rules: { minLength: 10, maxLength: 200 }

// Pattern matching
validation_rules: { pattern: '^[A-Z]{3}-\\d{3}$' }

// Email (detected by field_key containing 'email')
field_key: 'user_email'

// URL (detected by field_key containing 'url' or 'link')
field_key: 'website_url'
```

### Validation Hooks

```typescript
const validation = useFieldValidation(fields);

// Validate single field
validation.validateSingle('field_key', value);

// Validate all fields
const isValid = validation.validateAll(values);

// Get field error (only if touched)
const error = validation.getError('field_key');

// Check if form has errors
const hasErrors = validation.hasErrors();

// Clear validation
validation.clearValidation();
```

## Layout Options

### DynamicFieldGroup Layouts

```typescript
// Vertical stacking (default)
<DynamicFieldGroup layout="vertical" {...props} />

// Two-column grid
<DynamicFieldGroup layout="grid" {...props} />

// Explicit two-column
<DynamicFieldGroup layout="two-column" {...props} />
```

### Responsive Behavior

All layouts are mobile-responsive:
- **Vertical**: Always single column
- **Grid/Two-column**: Two columns on desktop, single column on mobile (breakpoint: md/768px)

## Conditional Logic

### Supported Operators

| Operator | Use Case | Example |
|----------|----------|---------|
| `equals` | Exact match | Show field when toggle is ON |
| `not_equals` | Inverse match | Show field when model is NOT GPT-4 |
| `contains` | String contains | Show field when text contains keyword |
| `greater_than` | Numeric comparison | Show field when value > threshold |
| `less_than` | Numeric comparison | Show field when value < threshold |

### Implementation

```typescript
// In platform_fields.conditional_logic
{
  field: 'enable_advanced',
  operator: 'equals',
  value: true
}

// DynamicFieldRenderer handles it automatically
<DynamicFieldRenderer
  field={conditionalField}
  allValues={allFormValues} // Must include dependent field value
  {...otherProps}
/>
```

## Performance Optimization

### Memoization

All components use React.memo:
```typescript
export const DynamicFieldRenderer = memo(function DynamicFieldRenderer(props) {
  // Component implementation
});
```

### Best Practices

1. **Stable References**: Use useCallback for change handlers
```typescript
const handleChange = useCallback((key: string, value: any) => {
  setValues(prev => ({ ...prev, [key]: value }));
}, []);
```

2. **Memoize Values**: Use useMemo for derived data
```typescript
const sortedFields = useMemo(
  () => fields.sort((a, b) => a.display_order - b.display_order),
  [fields]
);
```

3. **Avoid Prop Drilling**: Use context for deeply nested forms
```typescript
const FormContext = createContext<FormContextType>(null);

function FormProvider({ children, fields }) {
  const validation = useFieldValidation(fields);
  return (
    <FormContext.Provider value={{ validation }}>
      {children}
    </FormContext.Provider>
  );
}
```

## Error Handling

### Field-Level Errors

```tsx
<DynamicFieldRenderer
  error="This field is required"
  // OR
  error={["Too short", "Invalid format"]}
/>
```

### Form-Level Errors

```tsx
<ValidationErrorList 
  errors={getFormErrors(validation.validationResults)}
/>
```

### Toast Notifications

```tsx
const errorMessage = formatErrorsForToast(validation.validationResults);
toast({
  variant: isValid ? "default" : "destructive",
  title: errorMessage.title,
  description: errorMessage.description
});
```

## Styling & Theming

### Design System

All components use semantic tokens from `index.css`:
```css
--primary
--secondary
--accent
--muted
--border
```

### Custom Styling

```tsx
// Add custom classes
<DynamicFieldRenderer className="custom-field" />
<DynamicFieldGroup className="custom-group" />
<FieldSection className="custom-section" />
```

### Mobile Optimization

All components are mobile-first:
- Touch-friendly targets (min 44px)
- Responsive layouts
- Optimized for small screens

## Testing

### Unit Tests

```typescript
describe('DynamicFieldRenderer', () => {
  it('renders correct component for field type', () => {
    const field = { field_type: 'text', /* ... */ };
    render(<DynamicFieldRenderer field={field} {...props} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
describe('Complete Form', () => {
  it('validates and submits form', async () => {
    render(<CompleteForm fields={testFields} />);
    
    // Fill fields
    await userEvent.type(screen.getByLabelText('Name'), 'John');
    
    // Submit
    await userEvent.click(screen.getByText('Submit'));
    
    // Check validation
    expect(mockSubmit).toHaveBeenCalledWith({ name: 'John' });
  });
});
```

## Migration Guide

### From Static Forms

**Before:**
```tsx
<div>
  <Input label="Name" />
  <Textarea label="Bio" />
  <Select label="Model" options={[...]} />
</div>
```

**After:**
```tsx
<DynamicFieldGroup
  fields={fieldsFromDatabase}
  values={values}
  onChange={handleChange}
  layout="vertical"
/>
```

### Benefits

- ✅ Database-driven configuration
- ✅ No code changes for new fields
- ✅ Automatic validation
- ✅ Conditional logic support
- ✅ Consistent styling
- ✅ Type-safe implementation

## Demo Page

Visit `/admin` route to see all components in action with:
- Individual field examples
- Validation demonstrations
- Layout comparisons
- Complete form examples
- Interactive testing

## API Reference

### DynamicFieldRenderer

```typescript
interface DynamicFieldRendererProps {
  field: PlatformField;
  value: any;
  onChange: (value: any) => void;
  error?: string | string[];
  disabled?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
  allValues?: Record<string, any>;
  className?: string;
}
```

### DynamicFieldGroup

```typescript
interface DynamicFieldGroupProps {
  fields: PlatformField[];
  values: Record<string, any>;
  onChange: (fieldKey: string, value: any) => void;
  errors?: Record<string, string | string[]>;
  disabled?: boolean;
  onBlur?: (fieldKey: string) => void;
  layout?: 'vertical' | 'grid' | 'two-column';
  className?: string;
}
```

### FieldSection

```typescript
interface FieldSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  className?: string;
}
```

## Troubleshooting

### Common Issues

**Field not rendering:**
- Check `field_type` is valid
- Verify field object has all required properties
- Check console for warnings

**Validation not working:**
- Ensure validation hook is initialized
- Check `onBlur` is called
- Verify field has been touched

**Conditional logic not working:**
- Pass `allValues` prop to DynamicFieldRenderer
- Check dependent field value exists
- Verify operator matches expected behavior

## Future Enhancements

- [ ] File upload field type
- [ ] Date/time picker field type
- [ ] Rich text editor field type
- [ ] Multi-select field type
- [ ] Async validation support
- [ ] Field dependencies (calculated fields)
- [ ] Custom field components registry
- [ ] Drag-and-drop field ordering

## Support

For issues or questions:
1. Check the demo page at `/admin`
2. Review component documentation
3. Check validation system docs
4. Review test cases

## Related Documentation

- [DynamicFieldRenderer](./fields/DynamicFieldRenderer.README.md)
- [Validation System](../../lib/validation/README.md)
- [Platform Types](../../types/platform.ts)

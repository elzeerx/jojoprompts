# useDynamicForm Hook

Complete form management hook for dynamic forms with built-in validation, state management, and submission handling.

## Overview

The `useDynamicForm` hook provides a complete solution for managing dynamic forms based on `PlatformField` configurations. It handles:

- ✅ Form state management
- ✅ Default value parsing
- ✅ Built-in validation
- ✅ Submission handling
- ✅ Loading states
- ✅ Dirty tracking
- ✅ Form reset

## Basic Usage

```tsx
import { useDynamicForm } from '@/hooks/useDynamicForm';
import { DynamicFieldGroup } from '@/components/prompts/fields';

function MyForm({ fields }: { fields: PlatformField[] }) {
  const form = useDynamicForm({
    fields,
    onSubmit: async (values) => {
      await saveToDatabase(values);
      toast.success('Saved successfully!');
    }
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <DynamicFieldGroup
        fields={fields}
        values={form.values}
        onChange={form.setValue}
        errors={Object.fromEntries(
          fields.map(field => [
            field.field_key,
            form.getError(field.field_key)
          ])
        )}
        onBlur={form.handleBlur}
      />
      <button type="submit" disabled={form.isSubmitting}>
        {form.isSubmitting ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
```

## API Reference

### Options

```typescript
interface UseDynamicFormOptions {
  fields: PlatformField[];           // Field configurations
  initialValues?: Record<string, any>; // Initial form values
  onSubmit?: (values: Record<string, any>) => void | Promise<void>; // Submit handler
}
```

### Return Value

```typescript
{
  // Form values
  values: Record<string, any>;
  
  // Value setters
  setValue: (fieldKey: string, value: any) => void;
  setMultipleValues: (values: Record<string, any>) => void;
  
  // Event handlers
  handleBlur: (fieldKey: string) => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  
  // Form actions
  reset: () => void;
  
  // Form state
  isSubmitting: boolean;
  hasErrors: boolean;
  isDirty: boolean;
  
  // Validation methods
  getError: (fieldKey: string) => string | undefined;
  validateAll: () => boolean;
  validateSingle: (fieldKey: string) => boolean;
}
```

## Features

### 1. Automatic Default Value Parsing

The hook automatically parses default values based on field type:

```typescript
// Number fields - parsed as float
{
  field_type: 'number',
  default_value: '42.5'
} // → 42.5

// Slider fields - parsed as float
{
  field_type: 'slider',
  default_value: '0.7'
} // → 0.7

// Toggle fields - parsed as boolean
{
  field_type: 'toggle',
  default_value: 'true'
} // → true

// Text fields - used as-is
{
  field_type: 'text',
  default_value: 'Hello'
} // → 'Hello'
```

### 2. Built-in Validation

Validation is integrated automatically:

```tsx
const form = useDynamicForm({ fields, onSubmit });

// Validate on blur
<input onBlur={() => form.handleBlur('fieldKey')} />

// Get field error (only if touched)
const error = form.getError('fieldKey');

// Validate all fields
const isValid = form.validateAll();

// Check if form has any errors
if (form.hasErrors) {
  // Show error message
}
```

### 3. Submission Handling

Handles async submission with loading state:

```tsx
const form = useDynamicForm({
  fields,
  onSubmit: async (values) => {
    // Automatically sets isSubmitting to true
    await api.save(values);
    // Automatically sets isSubmitting back to false
  }
});

// In JSX
<button disabled={form.isSubmitting}>
  {form.isSubmitting ? 'Saving...' : 'Save'}
</button>
```

### 4. Dirty Tracking

Detects unsaved changes:

```tsx
const form = useDynamicForm({ fields, initialValues });

// Check if form has unsaved changes
if (form.isDirty) {
  // Show "You have unsaved changes" warning
}

// Reset clears dirty state
form.reset();
```

### 5. Form Reset

Reset form to initial state:

```tsx
<button onClick={form.reset}>
  Reset Form
</button>
```

## Examples

### Example 1: Simple Form

```tsx
function SimpleForm({ fields }: { fields: PlatformField[] }) {
  const form = useDynamicForm({
    fields,
    onSubmit: async (values) => {
      console.log('Submitted:', values);
    }
  });

  return (
    <form onSubmit={form.handleSubmit}>
      {fields.map(field => (
        <DynamicFieldRenderer
          key={field.field_key}
          field={field}
          value={form.values[field.field_key]}
          onChange={(val) => form.setValue(field.field_key, val)}
          error={form.getError(field.field_key)}
          onBlur={() => form.handleBlur(field.field_key)}
          allValues={form.values}
        />
      ))}
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Example 2: Form with Initial Values

```tsx
function EditForm({ fields, existingData }: Props) {
  const form = useDynamicForm({
    fields,
    initialValues: existingData,
    onSubmit: async (values) => {
      await updateData(values);
    }
  });

  return (
    <form onSubmit={form.handleSubmit}>
      <DynamicFieldGroup
        fields={fields}
        values={form.values}
        onChange={form.setValue}
        onBlur={form.handleBlur}
      />
      <div className="flex gap-2">
        <button type="submit" disabled={form.isSubmitting || !form.isDirty}>
          Save Changes
        </button>
        <button type="button" onClick={form.reset}>
          Cancel
        </button>
      </div>
    </form>
  );
}
```

### Example 3: Multi-Section Form

```tsx
function MultiSectionForm({ fields }: { fields: PlatformField[] }) {
  const form = useDynamicForm({
    fields,
    initialValues: {
      name: '',
      email: '',
      temperature: 0.7,
      enable_feature: true
    },
    onSubmit: async (values) => {
      await saveSettings(values);
      toast.success('Settings saved!');
    }
  });

  const basicFields = fields.filter(f => f.display_order < 10);
  const advancedFields = fields.filter(f => f.display_order >= 10);

  return (
    <form onSubmit={form.handleSubmit}>
      <FieldSection title="Basic Settings" collapsible>
        <DynamicFieldGroup
          fields={basicFields}
          values={form.values}
          onChange={form.setValue}
          errors={Object.fromEntries(
            basicFields.map(f => [f.field_key, form.getError(f.field_key)])
          )}
          onBlur={form.handleBlur}
          layout="grid"
        />
      </FieldSection>

      <FieldSection title="Advanced Settings" collapsible defaultOpen={false}>
        <DynamicFieldGroup
          fields={advancedFields}
          values={form.values}
          onChange={form.setValue}
          errors={Object.fromEntries(
            advancedFields.map(f => [f.field_key, form.getError(f.field_key)])
          )}
          onBlur={form.handleBlur}
          layout="vertical"
        />
      </FieldSection>

      <div className="flex gap-2">
        <button type="submit" disabled={form.isSubmitting}>
          {form.isSubmitting ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={form.reset}>
          Reset
        </button>
      </div>

      {form.isDirty && (
        <p className="text-sm text-muted-foreground">
          You have unsaved changes
        </p>
      )}
    </form>
  );
}
```

### Example 4: Form with Validation Display

```tsx
import { ValidationErrorList } from '@/components/prompts';
import { getFormErrors } from '@/lib/validation';

function ValidatedForm({ fields }: { fields: PlatformField[] }) {
  const form = useDynamicForm({
    fields,
    onSubmit: async (values) => {
      await submitForm(values);
    }
  });

  // Get validation results for error display
  const validationResults = fields.reduce((acc, field) => {
    const error = form.getError(field.field_key);
    if (error) {
      acc[field.field_key] = {
        isValid: false,
        errors: Array.isArray(error) ? error : [error]
      };
    }
    return acc;
  }, {} as Record<string, { isValid: boolean; errors: string[] }>);

  return (
    <form onSubmit={form.handleSubmit}>
      <DynamicFieldGroup
        fields={fields}
        values={form.values}
        onChange={form.setValue}
        errors={Object.fromEntries(
          fields.map(f => [f.field_key, form.getError(f.field_key)])
        )}
        onBlur={form.handleBlur}
      />

      {form.hasErrors && (
        <ValidationErrorList 
          errors={getFormErrors(validationResults)}
        />
      )}

      <button type="submit" disabled={form.isSubmitting || form.hasErrors}>
        Submit
      </button>
    </form>
  );
}
```

### Example 5: Form with Status Badges

```tsx
function FormWithStatus({ fields }: { fields: PlatformField[] }) {
  const form = useDynamicForm({ fields, onSubmit });

  return (
    <div>
      {/* Status badges */}
      <div className="flex gap-2 mb-4">
        <Badge variant={form.hasErrors ? "destructive" : "default"}>
          {form.hasErrors ? 'Has Errors' : 'Valid'}
        </Badge>
        <Badge variant={form.isDirty ? "secondary" : "outline"}>
          {form.isDirty ? 'Modified' : 'Saved'}
        </Badge>
        <Badge variant={form.isSubmitting ? "default" : "outline"}>
          {form.isSubmitting ? 'Submitting' : 'Ready'}
        </Badge>
      </div>

      <form onSubmit={form.handleSubmit}>
        <DynamicFieldGroup
          fields={fields}
          values={form.values}
          onChange={form.setValue}
          onBlur={form.handleBlur}
        />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
```

## Advanced Usage

### Custom Validation

```tsx
const form = useDynamicForm({ fields, onSubmit });

// Validate specific field
const isFieldValid = form.validateSingle('fieldKey');

// Validate all fields
const isFormValid = form.validateAll();

// Get error for field (only if touched)
const error = form.getError('fieldKey');
```

### Programmatic Value Updates

```tsx
// Set single value
form.setValue('temperature', 0.8);

// Set multiple values
form.setMultipleValues({
  temperature: 0.8,
  max_tokens: 2000,
  enable_feature: true
});
```

### Conditional Form Actions

```tsx
// Disable submit if form is invalid or unchanged
<button 
  type="submit" 
  disabled={form.isSubmitting || form.hasErrors || !form.isDirty}
>
  Save Changes
</button>

// Show warning if leaving with unsaved changes
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (form.isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [form.isDirty]);
```

## Integration with Other Components

### With DynamicFieldRenderer

```tsx
{fields.map(field => (
  <DynamicFieldRenderer
    key={field.field_key}
    field={field}
    value={form.values[field.field_key]}
    onChange={(val) => form.setValue(field.field_key, val)}
    error={form.getError(field.field_key)}
    onBlur={() => form.handleBlur(field.field_key)}
    allValues={form.values}
  />
))}
```

### With DynamicFieldGroup

```tsx
<DynamicFieldGroup
  fields={fields}
  values={form.values}
  onChange={form.setValue}
  errors={Object.fromEntries(
    fields.map(f => [f.field_key, form.getError(f.field_key)])
  )}
  onBlur={form.handleBlur}
  layout="grid"
/>
```

### With FieldSection

```tsx
<FieldSection title="Settings" collapsible>
  <DynamicFieldGroup
    fields={fields}
    values={form.values}
    onChange={form.setValue}
    onBlur={form.handleBlur}
  />
</FieldSection>
```

## Best Practices

### 1. Memoize Callbacks

```tsx
const handleSubmit = useCallback(async (values: Record<string, any>) => {
  await saveData(values);
}, []);

const form = useDynamicForm({
  fields,
  onSubmit: handleSubmit
});
```

### 2. Handle Errors Gracefully

```tsx
const form = useDynamicForm({
  fields,
  onSubmit: async (values) => {
    try {
      await api.save(values);
      toast.success('Saved!');
    } catch (error) {
      toast.error('Failed to save');
      throw error; // Re-throw to maintain isSubmitting state
    }
  }
});
```

### 3. Provide User Feedback

```tsx
{form.isSubmitting && <Spinner />}
{form.hasErrors && <Alert>Please fix errors</Alert>}
{form.isDirty && <Badge>Unsaved changes</Badge>}
```

### 4. Reset After Successful Submit

```tsx
const form = useDynamicForm({
  fields,
  onSubmit: async (values) => {
    await saveData(values);
    form.reset(); // Reset form after successful save
    toast.success('Saved!');
  }
});
```

## TypeScript

Fully typed with TypeScript:

```typescript
// Form values are typed as Record<string, any>
const form = useDynamicForm({ fields, onSubmit });
const values: Record<string, any> = form.values;

// You can create a typed wrapper
interface MyFormValues {
  name: string;
  age: number;
  enabled: boolean;
}

const form = useDynamicForm({ fields, onSubmit });
const typedValues = form.values as MyFormValues;
```

## Demo

See the demo at `/admin` route (PlatformTest page) for a live example of `useDynamicForm` in action.

## Related

- [useFieldValidation](./useFieldValidation.ts) - Validation hook
- [DynamicFieldRenderer](../components/prompts/fields/DynamicFieldRenderer.tsx)
- [DynamicFieldGroup](../components/prompts/fields/DynamicFieldGroup.tsx)
- [FieldSection](../components/prompts/FieldSection.tsx)

# Field Validation System

Comprehensive validation system for platform field inputs based on field configurations from the database.

## Overview

The validation system provides:
- Type-safe validation functions for all field types
- React hooks for form validation with state management
- Error formatting utilities for user-friendly error messages
- Automatic validation based on platform field configurations

## File Structure

```
src/lib/validation/
├── types.ts              # TypeScript type definitions
├── validators.ts         # Individual validation functions
├── validateField.ts      # Main validation orchestrator
├── validateForm.ts       # Form-level validation utilities
├── errorFormatters.ts    # Error message formatting utilities
├── useFieldValidation.ts # Advanced validation hook (deprecated)
├── index.ts             # Main exports
├── tests/
│   └── validators.test.ts # Test suite (commented)
└── README.md            # This file
```

**Note:** The main validation hook is now in `src/hooks/useFieldValidation.ts` for better organization.

## Quick Start

### Basic Usage

```typescript
import { validateField } from '@/lib/validation';
import { PlatformField } from '@/types/platform';

const field: PlatformField = {
  id: '123',
  platform_id: 'chatgpt',
  field_key: 'temperature',
  field_type: 'number',
  label: 'Temperature',
  is_required: true,
  validation_rules: { min: 0, max: 2 },
  // ... other required fields
};

const result = validateField(0.7, field);
// { isValid: true, errors: [] }

const invalidResult = validateField(3, field);
// { isValid: false, errors: ['Temperature must be at most 2'] }
```

### Using the React Hook

```typescript
import { useFieldValidation } from '@/lib/validation';
import { TextField } from '@/components/prompts/fields';

function MyForm({ fields }: { fields: PlatformField[] }) {
  const [values, setValues] = useState<Record<string, any>>({});
  
  const validation = useFieldValidation(fields);

  const handleSubmit = () => {
    const isValid = validation.validateAll(values);
    if (!isValid) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fix the errors and try again"
      });
      return;
    }
    // Submit form...
  };

  return (
    <form>
      {fields.map(field => (
        <TextField
          key={field.field_key}
          field={field}
          value={values[field.field_key]}
          onChange={(value) => {
            setValues(prev => ({ ...prev, [field.field_key]: value }));
            validation.validateSingle(field.field_key, value);
          }}
          error={validation.getError(field.field_key)}
          onBlur={() => validation.touchField(field.field_key)}
        />
      ))}
      <button onClick={handleSubmit}>Submit</button>
    </form>
  );
}
```

## Validation Rules

### Supported Validators

1. **Required** - Validates that a value is not empty
   ```typescript
   field.is_required = true
   ```

2. **Min/Max (Numbers)** - Validates number range
   ```typescript
   field.validation_rules = { min: 0, max: 100 }
   ```

3. **Min/Max Length (Strings)** - Validates string length
   ```typescript
   field.validation_rules = { minLength: 3, max: 500 }
   ```

4. **Pattern** - Validates against regex pattern
   ```typescript
   field.validation_rules = { pattern: '^[a-zA-Z0-9_]+$' }
   ```

5. **Email** - Validates email format
   ```typescript
   // Automatic for fields with email in name/placeholder
   ```

6. **URL** - Validates URL format
   ```typescript
   // Automatic for fields with url in name/placeholder
   ```

7. **JSON** - Validates JSON format for code fields
   ```typescript
   field.field_type = 'code'
   field.placeholder = 'Enter JSON...'
   ```

8. **Options** - Validates selection against available options
   ```typescript
   field.field_type = 'select'
   field.options = [{ label: 'Option 1', value: 'opt1' }]
   ```

## API Reference

### `validateField(value, field)`

Validates a single field value against its configuration.

**Parameters:**
- `value: any` - The value to validate
- `field: PlatformField` - The field configuration

**Returns:** `ValidationResult`
```typescript
{
  isValid: boolean;
  errors: string[];
}
```

### `validateFields(values, fields)`

Validates multiple fields at once.

**Parameters:**
- `values: Record<string, any>` - Field values keyed by field_key
- `fields: PlatformField[]` - Array of field configurations

**Returns:** `Record<string, ValidationResult>`

### `useFieldValidation(fields)`

React hook for form validation with state management.

**Parameters:**
- `fields: PlatformField[]` - Array of field configurations

**Returns:**
```typescript
{
  validateAll: (values: Record<string, any>) => boolean;
  validateSingle: (fieldKey: string, value: any) => boolean;
  touchField: (fieldKey: string) => void;
  getError: (fieldKey: string) => string | undefined;
  hasErrors: () => boolean;
  validationResults: FieldValidationResult;
  clearValidation: () => void;
  touched: Record<string, boolean>;
}
```

### Error Formatting Functions

#### `formatFieldErrors(result)`
Formats errors from a single field into a string.

#### `formatAllErrors(results)`
Formats all validation errors into a single message.

#### `getFirstError(results)`
Gets the first error message from validation results.

#### `hasErrors(results)`
Checks if any field has errors.

#### `getErrorCount(results)`
Returns the number of fields with errors.

#### `formatErrorsForToast(results)`
Formats errors for display in toast notifications.

```typescript
{
  title: string;
  description: string;
}
```

## Validation Flow

1. **Field Configuration** - Platform fields are fetched from database with validation_rules
2. **User Input** - User enters/changes value in field component
3. **Validation Trigger**
   - On blur (if validateOnBlur is true)
   - On change (if validateOnChange is true)
   - Manual validation (calling validateAllFields)
4. **Validation Execution** - All applicable validators run on the value
5. **Error Display** - Errors shown to user via field component's error prop
6. **Form Submission** - validateAllFields must return true before submission

## Best Practices

### 1. Touch Fields Before Showing Errors
```typescript
error={validation.getError(field.field_key)}
onBlur={() => validation.touchField(field.field_key)}
// Only shows error if field has been touched
```

### 2. Validate Single Fields on Change
```typescript
onChange={(value) => {
  setValues(prev => ({ ...prev, [key]: value }));
  validation.validateSingle(key, value);
}}
```

### 3. Clear Errors When Appropriate
```typescript
validation.clearValidation();  // Clear all validation state
```

### 4. Validate Before Submission
```typescript
const handleSubmit = () => {
  if (!validation.validateAll(values)) {
    const errorMessage = formatErrorsForToast(validation.validationResults);
    toast({
      variant: "destructive",
      ...errorMessage
    });
    return;
  }
  // Proceed with submission
};
```

### 5. Provide Good Error Messages
Error messages are automatically generated based on field labels:
- "Temperature is required"
- "Temperature must be at least 0"
- "Email format is invalid"

## Examples

### Example 1: Text Field with Length Validation
```typescript
const field: PlatformField = {
  field_key: 'bio',
  field_type: 'textarea',
  label: 'Bio',
  is_required: true,
  validation_rules: { max: 500 },
};

const result = validateField('This is my bio', field);
// { isValid: true, errors: [] }
```

### Example 2: Number Field with Range
```typescript
const field: PlatformField = {
  field_key: 'age',
  field_type: 'number',
  label: 'Age',
  is_required: true,
  validation_rules: { min: 18, max: 120 },
};

const result = validateField(15, field);
// { isValid: false, errors: ['Age must be at least 18'] }
```

### Example 3: Select Field with Options
```typescript
const field: PlatformField = {
  field_key: 'model',
  field_type: 'select',
  label: 'Model',
  is_required: true,
  options: [
    { label: 'GPT-4', value: 'gpt-4' },
    { label: 'GPT-3.5', value: 'gpt-3.5' }
  ],
};

const result = validateField('gpt-4', field);
// { isValid: true, errors: [] }
```

## Testing

Test validation logic in your components:

```typescript
import { validateField } from '@/lib/validation';

describe('Validation', () => {
  it('validates required field', () => {
    const field = { is_required: true, label: 'Name', /* ... */ };
    expect(validateField('', field).isValid).toBe(false);
    expect(validateField('John', field).isValid).toBe(true);
  });
});
```

## Extending the System

To add custom validators:

```typescript
// In validators.ts
export function validateCustomRule(value: any, field: PlatformField): ValidationResult {
  // Your custom validation logic
  if (/* invalid */) {
    return {
      isValid: false,
      errors: ['Custom error message']
    };
  }
  return { isValid: true, errors: [] };
}

// Add to validateField function
const validators = [
  validateRequired,
  // ... other validators
  validateCustomRule  // Add your validator
];
```

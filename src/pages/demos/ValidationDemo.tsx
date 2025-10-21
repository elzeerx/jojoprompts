import { useState } from 'react';
import { TextField, TextareaField, NumberField } from '@/components/prompts/fields';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFieldValidation, formatErrorsForToast } from '@/lib/validation';
import { useToast } from '@/hooks/use-toast';
import type { PlatformField } from '@/types/platform';

export function ValidationDemo() {
  const { toast } = useToast();
  
  const [values, setValues] = useState<Record<string, any>>({
    required: '',
    email: '',
    age: '',
    bio: '',
  });

  const validationFields: PlatformField[] = [
    {
      id: 'val-required',
      platform_id: 'demo',
      field_key: 'required',
      field_type: 'text',
      label: 'Required Field',
      placeholder: 'This field is required',
      is_required: true,
      display_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'val-email',
      platform_id: 'demo',
      field_key: 'email',
      field_type: 'text',
      label: 'Email Address',
      placeholder: 'user@example.com',
      is_required: false,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'val-age',
      platform_id: 'demo',
      field_key: 'age',
      field_type: 'number',
      label: 'Age (18-100)',
      placeholder: 'Enter age',
      validation_rules: { min: 18, max: 100 },
      is_required: false,
      display_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'val-bio',
      platform_id: 'demo',
      field_key: 'bio',
      field_type: 'textarea',
      label: 'Bio (10-200 chars)',
      placeholder: 'Enter at least 10 characters',
      validation_rules: { minLength: 10, maxLength: 200 },
      is_required: false,
      display_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const validation = useFieldValidation(validationFields);

  const handleValidateAll = () => {
    const isValid = validation.validateAll(values);
    const errorMessage = formatErrorsForToast(validation.validationResults);
    
    toast({
      variant: isValid ? "default" : "destructive",
      title: errorMessage.title,
      description: errorMessage.description,
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="default" className="text-xs">Phase 2.3</Badge>
          <h2 className="text-3xl font-bold">Validation System</h2>
        </div>
        <p className="text-muted-foreground">
          Client-side validation with real-time feedback
        </p>
      </div>

      {/* Validation Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Required Validation</CardTitle>
            <CardDescription>Field must not be empty</CardDescription>
          </CardHeader>
          <CardContent>
            <TextField
              field={validationFields[0]}
              value={values.required}
              onChange={(value) => {
                setValues({ ...values, required: value });
                validation.validateSingle('required', value);
              }}
              error={validation.validationResults.required?.errors?.[0]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Validation</CardTitle>
            <CardDescription>Must be valid email format</CardDescription>
          </CardHeader>
          <CardContent>
            <TextField
              field={validationFields[1]}
              value={values.email}
              onChange={(value) => {
                setValues({ ...values, email: value });
                validation.validateSingle('email', value);
              }}
              error={validation.validationResults.email?.errors?.[0]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Range Validation</CardTitle>
            <CardDescription>Number must be between 18 and 100</CardDescription>
          </CardHeader>
          <CardContent>
            <NumberField
              field={validationFields[2]}
              value={values.age}
              onChange={(value) => {
                setValues({ ...values, age: value });
                validation.validateSingle('age', value);
              }}
              error={validation.validationResults.age?.errors?.[0]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Length Validation</CardTitle>
            <CardDescription>Text must be 10-200 characters</CardDescription>
          </CardHeader>
          <CardContent>
            <TextareaField
              field={validationFields[3]}
              value={values.bio}
              onChange={(value) => {
                setValues({ ...values, bio: value });
                validation.validateSingle('bio', value);
              }}
              error={validation.validationResults.bio?.errors?.[0]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Validate Button */}
      <Card>
        <CardHeader>
          <CardTitle>Validate All Fields</CardTitle>
          <CardDescription>
            Click to run validation on all fields and see results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleValidateAll} size="lg" className="w-full">
            Validate All
          </Button>
        </CardContent>
      </Card>

      {/* Validation Rules */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">✨ Validation Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Required field validation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Email format validation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Number range validation</span>
              </li>
            </ul>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>String length validation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Real-time validation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span>Error message display</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

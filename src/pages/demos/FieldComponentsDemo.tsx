import { useState } from 'react';
import { TextField, TextareaField, NumberField, SelectField, SliderField, ToggleField, CodeField } from '@/components/prompts/fields';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PlatformField } from '@/types/platform';

export function FieldComponentsDemo() {
  const [values, setValues] = useState<Record<string, any>>({
    text: '',
    textarea: '',
    number: 50,
    select: '',
    slider: 50,
    toggle: false,
    code: '',
  });

  const sampleFields: Record<string, PlatformField> = {
    text: {
      id: 'demo-text',
      platform_id: 'demo',
      field_key: 'text',
      field_type: 'text',
      label: 'Sample Text Field',
      placeholder: 'Enter some text...',
      is_required: true,
      help_text: 'This is a sample text field',
      display_order: 0,
      validation_rules: { max: 100 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    textarea: {
      id: 'demo-textarea',
      platform_id: 'demo',
      field_key: 'textarea',
      field_type: 'textarea',
      label: 'Sample Textarea',
      placeholder: 'Enter multiple lines...',
      is_required: false,
      help_text: 'Textarea with character counter',
      display_order: 1,
      validation_rules: { max: 500 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    number: {
      id: 'demo-number',
      platform_id: 'demo',
      field_key: 'number',
      field_type: 'number',
      label: 'Sample Number Field',
      placeholder: '0',
      is_required: true,
      help_text: 'Enter a number between 0 and 100',
      display_order: 2,
      validation_rules: { min: 0, max: 100 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    select: {
      id: 'demo-select',
      platform_id: 'demo',
      field_key: 'select',
      field_type: 'select',
      label: 'Sample Select Field',
      placeholder: 'Choose an option...',
      is_required: true,
      display_order: 3,
      options: [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
        { label: 'Option 3', value: 'opt3' },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    slider: {
      id: 'demo-slider',
      platform_id: 'demo',
      field_key: 'slider',
      field_type: 'slider',
      label: 'Sample Slider Field',
      is_required: false,
      help_text: 'Adjust the slider value',
      display_order: 4,
      validation_rules: { min: 0, max: 100, step: 5 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    toggle: {
      id: 'demo-toggle',
      platform_id: 'demo',
      field_key: 'toggle',
      field_type: 'toggle',
      label: 'Sample Toggle Field',
      is_required: false,
      help_text: 'Toggle this on or off',
      display_order: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    code: {
      id: 'demo-code',
      platform_id: 'demo',
      field_key: 'code',
      field_type: 'code',
      label: 'Sample Code Field',
      placeholder: 'Enter JSON code...',
      is_required: false,
      help_text: 'Enter valid JSON',
      display_order: 6,
      validation_rules: { max: 1000 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="default" className="text-xs">Phase 2.1-2.2</Badge>
          <h2 className="text-3xl font-bold">Field Components</h2>
        </div>
        <p className="text-muted-foreground">
          Individual form field components with various types
        </p>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Text Field</CardTitle>
            <CardDescription>Single-line text input with validation</CardDescription>
          </CardHeader>
          <CardContent>
            <TextField
              field={sampleFields.text}
              value={values.text}
              onChange={(value) => setValues({ ...values, text: value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Textarea Field</CardTitle>
            <CardDescription>Multi-line text input with character counter</CardDescription>
          </CardHeader>
          <CardContent>
            <TextareaField
              field={sampleFields.textarea}
              value={values.textarea}
              onChange={(value) => setValues({ ...values, textarea: value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Number Field</CardTitle>
            <CardDescription>Numeric input with min/max validation</CardDescription>
          </CardHeader>
          <CardContent>
            <NumberField
              field={sampleFields.number}
              value={values.number}
              onChange={(value) => setValues({ ...values, number: value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Select Field</CardTitle>
            <CardDescription>Dropdown selection with options</CardDescription>
          </CardHeader>
          <CardContent>
            <SelectField
              field={sampleFields.select}
              value={values.select}
              onChange={(value) => setValues({ ...values, select: value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slider Field</CardTitle>
            <CardDescription>Range slider with visual feedback</CardDescription>
          </CardHeader>
          <CardContent>
            <SliderField
              field={sampleFields.slider}
              value={values.slider}
              onChange={(value) => setValues({ ...values, slider: value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Toggle Field</CardTitle>
            <CardDescription>Boolean switch component</CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleField
              field={sampleFields.toggle}
              value={values.toggle}
              onChange={(value) => setValues({ ...values, toggle: value })}
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Code Field</CardTitle>
            <CardDescription>Code editor for JSON/structured data</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeField
              field={sampleFields.code}
              value={values.code}
              onChange={(value) => setValues({ ...values, code: value })}
            />
          </CardContent>
        </Card>
      </div>

      {/* Current Values */}
      <Card className="bg-muted">
        <CardHeader>
          <CardTitle className="text-sm">Current Values</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(values, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

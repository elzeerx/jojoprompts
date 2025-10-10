/**
 * PlatformTest.tsx
 * 
 * Demo/Test page to verify the platform system works correctly.
 * This page displays all platforms with their fields and allows testing
 * of platform selection and field rendering.
 * 
 * FOR TESTING ONLY - NOT FOR PRODUCTION USE
 */

import { useState } from 'react';
import { Container } from '@/components/ui/container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePlatforms, usePlatformWithFields } from '@/hooks/usePlatforms';
import { TextField, TextareaField, NumberField, SelectField, SliderField, ToggleField, CodeField, DynamicFieldRenderer, DynamicFieldGroup } from '@/components/prompts/fields';
import { FieldSection, ValidationErrorList } from '@/components/prompts';
import { useFieldValidation, formatErrorsForToast, hasErrors, getFormErrors } from '@/lib/validation';
import { useDynamicForm } from '@/hooks/useDynamicForm';
import type { PlatformField } from '@/types/platform';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PlatformTest() {
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('');
  const { toast } = useToast();
  
  // Test field values
  const [testValues, setTestValues] = useState<Record<string, any>>({
    test_text: '',
    test_textarea: '',
    test_number: 50,
    test_select: '',
    test_slider: 50,
    test_toggle: false,
    test_code: '',
    // Validation test fields
    required_field: '',
    age_field: '',
    bio_field: '',
    email_field: '',
    url_field: '',
    pattern_field: '',
  });

  // Test error states
  const [showErrors, setShowErrors] = useState(false);
  
  // Individual field states for disabled and error
  const [fieldStates, setFieldStates] = useState<Record<string, { disabled: boolean; showError: boolean }>>({
    test_text: { disabled: false, showError: false },
    test_textarea: { disabled: false, showError: false },
    test_number: { disabled: false, showError: false },
    test_select: { disabled: false, showError: false },
    test_slider: { disabled: false, showError: false },
    test_toggle: { disabled: false, showError: false },
    test_code: { disabled: false, showError: false },
    // Validation test fields
    required_field: { disabled: false, showError: false },
    age_field: { disabled: false, showError: false },
    bio_field: { disabled: false, showError: false },
    email_field: { disabled: false, showError: false },
    url_field: { disabled: false, showError: false },
    pattern_field: { disabled: false, showError: false },
  });

  const toggleDisabled = (fieldKey: string) => {
    setFieldStates(prev => ({
      ...prev,
      [fieldKey]: { ...prev[fieldKey], disabled: !prev[fieldKey].disabled }
    }));
  };

  const toggleError = (fieldKey: string) => {
    setFieldStates(prev => ({
      ...prev,
      [fieldKey]: { ...prev[fieldKey], showError: !prev[fieldKey].showError }
    }));
  };
  
  // Fetch all platforms
  const { data: platforms, isLoading: platformsLoading, error: platformsError } = usePlatforms();
  
  // Fetch selected platform with fields
  const { data: platformWithFields, isLoading: fieldsLoading, error: fieldsError } = usePlatformWithFields(
    selectedPlatformId
  );

  // Helper to get icon component
  const getIconComponent = (iconName: string): LucideIcon => {
    const Icon = (LucideIcons as any)[iconName];
    return Icon || LucideIcons.Sparkles;
  };

  // Sample field configurations for testing
  const sampleFields: Record<string, PlatformField> = {
    test_text: {
      id: 'test-1',
      platform_id: 'test-platform',
      field_key: 'test_text',
      field_type: 'text',
      label: 'Sample Text Field',
      placeholder: 'Enter some text here...',
      is_required: true,
      help_text: 'This is a sample text field with help text tooltip',
      display_order: 0,
      validation_rules: { max: 100 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    test_textarea: {
      id: 'test-2',
      platform_id: 'test-platform',
      field_key: 'test_textarea',
      field_type: 'textarea',
      label: 'Sample Textarea Field',
      placeholder: 'Enter multiple lines of text...',
      is_required: false,
      help_text: 'This textarea has a character counter',
      display_order: 1,
      validation_rules: { max: 500, min: 3 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    test_number: {
      id: 'test-3',
      platform_id: 'test-platform',
      field_key: 'test_number',
      field_type: 'number',
      label: 'Sample Number Field',
      placeholder: '0',
      is_required: true,
      help_text: 'Enter a number between 0 and 100',
      display_order: 2,
      validation_rules: { min: 0, max: 100, step: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    test_text_error: {
      id: 'test-4',
      platform_id: 'test-platform',
      field_key: 'test_text_error',
      field_type: 'text',
      label: 'Text Field (with error state)',
      placeholder: 'This field shows an error',
      is_required: true,
      display_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    test_textarea_error: {
      id: 'test-5',
      platform_id: 'test-platform',
      field_key: 'test_textarea_error',
      field_type: 'textarea',
      label: 'Textarea (with error state)',
      placeholder: 'This field shows an error',
      is_required: false,
      display_order: 4,
      validation_rules: { max: 200 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    test_number_error: {
      id: 'test-6',
      platform_id: 'test-platform',
      field_key: 'test_number_error',
      field_type: 'number',
      label: 'Number Field (with error state)',
      placeholder: '0',
      is_required: true,
      display_order: 5,
      validation_rules: { min: 0, max: 100 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    test_select: {
      id: 'test-7',
      platform_id: 'test-platform',
      field_key: 'test_select',
      field_type: 'select',
      label: 'Sample Select Field',
      placeholder: 'Choose an option...',
      is_required: true,
      help_text: 'Select from dropdown options',
      display_order: 6,
      options: [
        { label: 'Option 1', value: 'opt1' },
        { label: 'Option 2', value: 'opt2' },
        { label: 'Option 3', value: 'opt3' },
        { label: 'Option 4', value: 'opt4' },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    test_slider: {
      id: 'test-8',
      platform_id: 'test-platform',
      field_key: 'test_slider',
      field_type: 'slider',
      label: 'Sample Slider Field',
      is_required: false,
      help_text: 'Adjust the slider value',
      display_order: 7,
      validation_rules: { min: 0, max: 100, step: 5 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    test_toggle: {
      id: 'test-9',
      platform_id: 'test-platform',
      field_key: 'test_toggle',
      field_type: 'toggle',
      label: 'Sample Toggle Field',
      placeholder: 'Enable or disable this feature',
      is_required: false,
      help_text: 'Toggle this on or off',
      display_order: 8,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    test_code: {
      id: 'test-10',
      platform_id: 'test-platform',
      field_key: 'test_code',
      field_type: 'code',
      label: 'Sample Code Field',
      placeholder: 'Enter JSON code...',
      is_required: false,
      help_text: 'Enter valid JSON code',
      display_order: 9,
      validation_rules: { max: 1000, min: 5 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    test_select_error: {
      id: 'test-11',
      platform_id: 'test-platform',
      field_key: 'test_select_error',
      field_type: 'select',
      label: 'Select Field (with error state)',
      placeholder: 'Choose an option...',
      is_required: true,
      display_order: 10,
      options: [
        { label: 'Red', value: 'red' },
        { label: 'Blue', value: 'blue' },
        { label: 'Green', value: 'green' },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    test_slider_error: {
      id: 'test-12',
      platform_id: 'test-platform',
      field_key: 'test_slider_error',
      field_type: 'slider',
      label: 'Slider Field (with error state)',
      is_required: true,
      display_order: 11,
      validation_rules: { min: 0, max: 100, step: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    test_toggle_error: {
      id: 'test-13',
      platform_id: 'test-platform',
      field_key: 'test_toggle_error',
      field_type: 'toggle',
      label: 'Toggle Field (with error state)',
      placeholder: 'Must be enabled',
      is_required: true,
      display_order: 12,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    test_code_error: {
      id: 'test-14',
      platform_id: 'test-platform',
      field_key: 'test_code_error',
      field_type: 'code',
      label: 'Code Field (with error state)',
      placeholder: 'Enter valid JSON...',
      is_required: true,
      display_order: 13,
      validation_rules: { max: 500 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    // Validation test fields
    required_field: {
      id: 'test-required',
      platform_id: 'test',
      field_key: 'required_field',
      field_type: 'text',
      label: 'Required Field',
      placeholder: 'This field is required',
      is_required: true,
      display_order: 14,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    age_field: {
      id: 'test-number-range',
      platform_id: 'test',
      field_key: 'age_field',
      field_type: 'number',
      label: 'Age (18-100)',
      placeholder: 'Enter age between 18 and 100',
      validation_rules: { min: 18, max: 100 },
      is_required: false,
      display_order: 15,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    bio_field: {
      id: 'test-string-length',
      platform_id: 'test',
      field_key: 'bio_field',
      field_type: 'textarea',
      label: 'Bio (10-200 chars)',
      placeholder: 'Enter at least 10 characters',
      validation_rules: { minLength: 10, maxLength: 200 },
      is_required: false,
      display_order: 16,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    email_field: {
      id: 'test-email',
      platform_id: 'test',
      field_key: 'email_field',
      field_type: 'text',
      label: 'Email Address',
      placeholder: 'user@example.com',
      is_required: false,
      display_order: 17,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    url_field: {
      id: 'test-url',
      platform_id: 'test',
      field_key: 'url_field',
      field_type: 'text',
      label: 'Website URL',
      placeholder: 'https://example.com',
      is_required: false,
      display_order: 18,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    pattern_field: {
      id: 'test-pattern',
      platform_id: 'test',
      field_key: 'pattern_field',
      field_type: 'text',
      label: 'Code Pattern',
      placeholder: 'ABC-123',
      validation_rules: { pattern: '^[A-Z]{3}-\\d{3}$' },
      is_required: false,
      display_order: 19,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };

  // Initialize validation hook with all sample fields
  const sampleFieldsArray = Object.values(sampleFields);
  const validation = useFieldValidation(sampleFieldsArray);

  const handleValueChange = (key: string, value: any) => {
    setTestValues(prev => ({ ...prev, [key]: value }));
    validation.validateSingle(key, value);
  };

  const handleValidateAll = () => {
    const isValid = validation.validateAll(testValues);
    const errorMessage = formatErrorsForToast(validation.validationResults);
    
    toast({
      variant: isValid ? "default" : "destructive",
      title: errorMessage.title,
      description: errorMessage.description,
    });
  };

  return (
    <Container className="py-12">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Platform System Test</h1>
          <p className="text-muted-foreground text-lg">
            Verify that all platforms and fields are configured correctly
          </p>
          <Alert>
            <AlertDescription>
              🧪 This is a test page for developers. Not intended for production use.
            </AlertDescription>
          </Alert>
        </div>

        {/* Platform Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Available Platforms</CardTitle>
            <CardDescription>
              All active platforms loaded from the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            {platformsLoading && (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}

            {platformsError && (
              <Alert variant="destructive">
                <AlertDescription>
                  Error loading platforms: {platformsError.message}
                </AlertDescription>
              </Alert>
            )}

            {platforms && platforms.length === 0 && (
              <Alert>
                <AlertDescription>
                  No platforms found. Please run the seed data migration.
                </AlertDescription>
              </Alert>
            )}

            {platforms && platforms.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {platforms.map((platform) => {
                  const Icon = getIconComponent(platform.icon);
                  return (
                    <Card key={platform.id} className="hover:border-primary/50 transition-colors">
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{platform.name}</CardTitle>
                            <CardDescription className="mt-1">
                              {platform.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="secondary">{platform.category}</Badge>
                          <Badge variant="outline">Order: {platform.display_order}</Badge>
                          {platform.is_active ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Platform Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Test Platform Fields</CardTitle>
            <CardDescription>
              Select a platform to view its configured fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Platform</label>
              <Select value={selectedPlatformId} onValueChange={setSelectedPlatformId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a platform..." />
                </SelectTrigger>
                <SelectContent>
                  {platforms?.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Platform Details */}
            {selectedPlatformId && (
              <>
                {fieldsLoading && (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                )}

                {fieldsError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Error loading fields: {fieldsError.message}
                    </AlertDescription>
                  </Alert>
                )}

                {platformWithFields && (
                  <div className="space-y-6 border-t pt-6">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const Icon = getIconComponent(platformWithFields.icon);
                        return <Icon className="h-8 w-8 text-primary" />;
                      })()}
                      <div>
                        <h3 className="text-xl font-semibold">{platformWithFields.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {platformWithFields.fields.length} configured fields
                        </p>
                      </div>
                    </div>

                    {platformWithFields.fields.length === 0 ? (
                      <Alert>
                        <AlertDescription>
                          No fields configured for this platform.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-4">
                        <h4 className="font-medium">Platform Fields:</h4>
                        <div className="grid gap-4">
                          {platformWithFields.fields.map((field) => (
                            <Card key={field.id}>
                              <CardContent className="pt-6">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <h5 className="font-medium">
                                        {field.label}
                                        {field.is_required && (
                                          <span className="text-destructive ml-1">*</span>
                                        )}
                                      </h5>
                                      <p className="text-sm text-muted-foreground">
                                        Key: <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                          {field.field_key}
                                        </code>
                                      </p>
                                    </div>
                                    <Badge>{field.field_type}</Badge>
                                  </div>

                                  {field.help_text && (
                                    <p className="text-sm text-muted-foreground">
                                      ℹ️ {field.help_text}
                                    </p>
                                  )}

                                  {field.placeholder && (
                                    <p className="text-xs text-muted-foreground">
                                      Placeholder: "{field.placeholder}"
                                    </p>
                                  )}

                                  {field.default_value && (
                                    <p className="text-xs">
                                      Default: <code className="bg-muted px-1 py-0.5 rounded">
                                        {field.default_value}
                                      </code>
                                    </p>
                                  )}

                                  {field.options && field.options.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      <span className="text-xs text-muted-foreground mr-2">Options:</span>
                                      {field.options.map((option, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs">
                                          {option.label}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}

                                  {field.validation_rules && Object.keys(field.validation_rules).length > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      Validation: <code className="bg-muted px-1 py-0.5 rounded">
                                        {JSON.stringify(field.validation_rules)}
                                      </code>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Field Components Test */}
        <Card>
          <CardHeader>
            <CardTitle>Field Components Showcase</CardTitle>
            <CardDescription>
              Interactive showcase of all 7 field components with individual controls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Global Controls */}
            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
              <Button 
                onClick={handleValidateAll}
                variant="default"
              >
                Validate All Fields
              </Button>
              <Button 
                onClick={validation.clearValidation}
                variant="outline"
              >
                Clear Validation Errors
              </Button>
              <Button 
                onClick={() => setTestValues({
                  test_text: 'Sample text',
                  test_textarea: 'This is a longer sample text that demonstrates the textarea component with multiple lines of content.',
                  test_number: 75,
                  test_select: 'opt2',
                  test_slider: 75,
                  test_toggle: true,
                  test_code: '{\n  "name": "Example",\n  "value": 123,\n  "active": true\n}',
                })}
                variant="secondary"
              >
                Fill Sample Data
              </Button>
              <Button 
                onClick={() => {
                  setTestValues({
                    test_text: '',
                    test_textarea: '',
                    test_number: 50,
                    test_select: '',
                    test_slider: 50,
                    test_toggle: false,
                    test_code: '',
                  });
                  validation.clearValidation();
                }}
                variant="outline"
              >
                Clear All Fields
              </Button>
              <div className="flex items-center gap-2 ml-auto">
                <Badge variant={!validation.hasErrors() ? "default" : "destructive"}>
                  {!validation.hasErrors() ? '✓ Valid' : '✗ Invalid'}
                </Badge>
              </div>
            </div>

            {/* Basic Input Fields Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Badge variant="default">Basic Input Fields</Badge>
                <span className="text-sm text-muted-foreground">Simple text, number, and textarea inputs</span>
              </div>

              {/* TextField Component */}
              <Card className="border-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">TextField Component</CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_text.showError ? "destructive" : "outline"}
                        onClick={() => toggleError('test_text')}
                      >
                        {fieldStates.test_text.showError ? 'Hide Error' : 'Show Error'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_text.disabled ? "secondary" : "outline"}
                        onClick={() => toggleDisabled('test_text')}
                      >
                        {fieldStates.test_text.disabled ? 'Enable' : 'Disable'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <TextField
                    field={sampleFields.test_text}
                    value={testValues.test_text}
                    onChange={(value) => handleValueChange('test_text', value)}
                    error={validation.getError('test_text')}
                    disabled={fieldStates.test_text.disabled}
                    onBlur={() => validation.touchField('test_text')}
                  />
                  <div className="p-3 bg-muted rounded text-sm">
                    <span className="font-semibold">Current Value:</span> 
                    <code className="ml-2 px-2 py-1 bg-background rounded">{testValues.test_text || '(empty)'}</code>
                  </div>
                </CardContent>
              </Card>

              {/* TextareaField Component */}
              <Card className="border-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">TextareaField Component</CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_textarea.showError ? "destructive" : "outline"}
                        onClick={() => toggleError('test_textarea')}
                      >
                        {fieldStates.test_textarea.showError ? 'Hide Error' : 'Show Error'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_textarea.disabled ? "secondary" : "outline"}
                        onClick={() => toggleDisabled('test_textarea')}
                      >
                        {fieldStates.test_textarea.disabled ? 'Enable' : 'Disable'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <TextareaField
                    field={sampleFields.test_textarea}
                    value={testValues.test_textarea}
                    onChange={(value) => handleValueChange('test_textarea', value)}
                    error={validation.getError('test_textarea')}
                    disabled={fieldStates.test_textarea.disabled}
                    onBlur={() => validation.touchField('test_textarea')}
                  />
                  <div className="p-3 bg-muted rounded text-sm">
                    <span className="font-semibold">Current Value:</span> 
                    <code className="ml-2 px-2 py-1 bg-background rounded block mt-2 max-h-20 overflow-auto">
                      {testValues.test_textarea || '(empty)'}
                    </code>
                  </div>
                </CardContent>
              </Card>

              {/* NumberField Component */}
              <Card className="border-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">NumberField Component</CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_number.showError ? "destructive" : "outline"}
                        onClick={() => toggleError('test_number')}
                      >
                        {fieldStates.test_number.showError ? 'Hide Error' : 'Show Error'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_number.disabled ? "secondary" : "outline"}
                        onClick={() => toggleDisabled('test_number')}
                      >
                        {fieldStates.test_number.disabled ? 'Enable' : 'Disable'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <NumberField
                    field={sampleFields.test_number}
                    value={testValues.test_number}
                    onChange={(value) => handleValueChange('test_number', value)}
                    error={validation.getError('test_number')}
                    disabled={fieldStates.test_number.disabled}
                    onBlur={() => validation.touchField('test_number')}
                  />
                  <div className="p-3 bg-muted rounded text-sm">
                    <span className="font-semibold">Current Value:</span> 
                    <code className="ml-2 px-2 py-1 bg-background rounded">{testValues.test_number ?? '(empty)'}</code>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Advanced Input Fields Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Badge variant="secondary">Advanced Input Fields</Badge>
                <span className="text-sm text-muted-foreground">Dropdowns, sliders, toggles, and code editors</span>
              </div>

              {/* SelectField Component */}
              <Card className="border-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">SelectField Component</CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_select.showError ? "destructive" : "outline"}
                        onClick={() => toggleError('test_select')}
                      >
                        {fieldStates.test_select.showError ? 'Hide Error' : 'Show Error'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_select.disabled ? "secondary" : "outline"}
                        onClick={() => toggleDisabled('test_select')}
                      >
                        {fieldStates.test_select.disabled ? 'Enable' : 'Disable'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SelectField
                    field={sampleFields.test_select}
                    value={testValues.test_select}
                    onChange={(value) => handleValueChange('test_select', value)}
                    error={validation.getError('test_select')}
                    disabled={fieldStates.test_select.disabled}
                    onBlur={() => validation.touchField('test_select')}
                  />
                  <div className="p-3 bg-muted rounded text-sm">
                    <span className="font-semibold">Current Value:</span> 
                    <code className="ml-2 px-2 py-1 bg-background rounded">{testValues.test_select || '(empty)'}</code>
                  </div>
                </CardContent>
              </Card>

              {/* SliderField Component */}
              <Card className="border-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">SliderField Component</CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_slider.showError ? "destructive" : "outline"}
                        onClick={() => toggleError('test_slider')}
                      >
                        {fieldStates.test_slider.showError ? 'Hide Error' : 'Show Error'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_slider.disabled ? "secondary" : "outline"}
                        onClick={() => toggleDisabled('test_slider')}
                      >
                        {fieldStates.test_slider.disabled ? 'Enable' : 'Disable'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SliderField
                    field={sampleFields.test_slider}
                    value={testValues.test_slider}
                    onChange={(value) => handleValueChange('test_slider', value)}
                    error={validation.getError('test_slider')}
                    disabled={fieldStates.test_slider.disabled}
                    onBlur={() => validation.touchField('test_slider')}
                  />
                  <div className="p-3 bg-muted rounded text-sm">
                    <span className="font-semibold">Current Value:</span> 
                    <code className="ml-2 px-2 py-1 bg-background rounded">{testValues.test_slider}</code>
                  </div>
                </CardContent>
              </Card>

              {/* ToggleField Component */}
              <Card className="border-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">ToggleField Component</CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_toggle.showError ? "destructive" : "outline"}
                        onClick={() => toggleError('test_toggle')}
                      >
                        {fieldStates.test_toggle.showError ? 'Hide Error' : 'Show Error'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_toggle.disabled ? "secondary" : "outline"}
                        onClick={() => toggleDisabled('test_toggle')}
                      >
                        {fieldStates.test_toggle.disabled ? 'Enable' : 'Disable'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ToggleField
                    field={sampleFields.test_toggle}
                    value={testValues.test_toggle}
                    onChange={(value) => handleValueChange('test_toggle', value)}
                    error={validation.getError('test_toggle')}
                    disabled={fieldStates.test_toggle.disabled}
                  />
                  <div className="p-3 bg-muted rounded text-sm">
                    <span className="font-semibold">Current Value:</span> 
                    <code className="ml-2 px-2 py-1 bg-background rounded">
                      {testValues.test_toggle ? 'true (On)' : 'false (Off)'}
                    </code>
                  </div>
                </CardContent>
              </Card>

              {/* CodeField Component */}
              <Card className="border-2">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">CodeField Component</CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_code.showError ? "destructive" : "outline"}
                        onClick={() => toggleError('test_code')}
                      >
                        {fieldStates.test_code.showError ? 'Hide Error' : 'Show Error'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant={fieldStates.test_code.disabled ? "secondary" : "outline"}
                        onClick={() => toggleDisabled('test_code')}
                      >
                        {fieldStates.test_code.disabled ? 'Enable' : 'Disable'}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CodeField
                    field={sampleFields.test_code}
                    value={testValues.test_code}
                    onChange={(value) => handleValueChange('test_code', value)}
                    error={validation.getError('test_code')}
                    disabled={fieldStates.test_code.disabled}
                    onBlur={() => validation.touchField('test_code')}
                  />
                  <div className="p-3 bg-muted rounded text-sm">
                    <span className="font-semibold">Current Value:</span> 
                    <pre className="ml-2 px-2 py-1 bg-background rounded text-xs mt-2 max-h-40 overflow-auto">
{testValues.test_code || '(empty)'}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Feature Summary */}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-lg">Component Features Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">All Components Support:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>✓ Required field indicators (*)</li>
                      <li>✓ Help text tooltips (info icon)</li>
                      <li>✓ Error state display</li>
                      <li>✓ Disabled state</li>
                      <li>✓ Placeholder text</li>
                      <li>✓ Real-time value updates</li>
                      <li>✓ Accessible ARIA labels</li>
                      <li>✓ Mobile responsive design</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Special Features:</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>✓ TextareaField: Character counter</li>
                      <li>✓ NumberField: Min/Max validation</li>
                      <li>✓ SelectField: Dropdown with options</li>
                      <li>✓ SliderField: Real-time value display</li>
                      <li>✓ ToggleField: On/Off indicator</li>
                      <li>✓ CodeField: Line count & JSON formatter</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Validation Testing Section */}
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>🧪 Validation Testing</span>
                  <Badge variant="outline">Phase 2.3</Badge>
                </CardTitle>
                <CardDescription>
                  Test all validation rules - required, ranges, length, patterns, email, and URL validation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Validation Test Controls */}
                <div className="flex flex-wrap gap-2 items-center p-4 bg-muted/50 rounded-lg border">
                  <Button 
                    onClick={() => {
                      const isValid = validation.validateAll(testValues);
                      const errorMessage = formatErrorsForToast(validation.validationResults);
                      
                      toast({
                        variant: isValid ? "default" : "destructive",
                        title: errorMessage.title,
                        description: errorMessage.description,
                      });
                    }}
                    variant="default"
                  >
                    Validate All
                  </Button>
                  <Button 
                    onClick={() => {
                      setTestValues(prev => ({
                        ...prev,
                        required_field: '',
                        age_field: '',
                        bio_field: '',
                        email_field: '',
                        url_field: '',
                        pattern_field: '',
                      }));
                      validation.clearValidation();
                    }}
                    variant="outline"
                  >
                    Clear Validation Tests
                  </Button>
                  <Button 
                    onClick={() => {
                      setTestValues(prev => ({
                        ...prev,
                        required_field: 'Sample value',
                        age_field: 25,
                        bio_field: 'This is a valid bio with enough characters to pass validation',
                        email_field: 'user@example.com',
                        url_field: 'https://example.com',
                        pattern_field: 'ABC-123',
                      }));
                    }}
                    variant="secondary"
                  >
                    Fill Valid Data
                  </Button>
                  <Button 
                    onClick={() => {
                      setTestValues(prev => ({
                        ...prev,
                        required_field: '', // Empty (invalid)
                        age_field: 150, // Out of range (invalid)
                        bio_field: 'Short', // Too short (invalid)
                        email_field: 'notanemail', // Invalid format
                        url_field: 'not-a-url', // Invalid format
                        pattern_field: '123-ABC', // Wrong pattern
                      }));
                    }}
                    variant="destructive"
                  >
                    Fill Invalid Data
                  </Button>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Required Field Test */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Required Field Test</CardTitle>
                      <CardDescription className="text-xs">
                        Leave empty and validate to see required error
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <TextField
                        field={{
                          id: 'test-required',
                          platform_id: 'test',
                          field_key: 'required_field',
                          field_type: 'text',
                          label: 'Required Field',
                          placeholder: 'This field is required',
                          is_required: true,
                          display_order: 0,
                          created_at: '',
                          updated_at: ''
                        }}
                        value={testValues.required_field}
                        onChange={(value) => handleValueChange('required_field', value)}
                        error={validation.getError('required_field')}
                        onBlur={() => validation.touchField('required_field')}
                      />
                      <div className="text-xs p-2 bg-muted rounded">
                        <strong>Value:</strong> {testValues.required_field || '(empty)'}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Number Range Test */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Number Range Test</CardTitle>
                      <CardDescription className="text-xs">
                        Try values outside 18-100 range
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <NumberField
                        field={{
                          id: 'test-number-range',
                          platform_id: 'test',
                          field_key: 'age_field',
                          field_type: 'number',
                          label: 'Age (18-100)',
                          placeholder: 'Enter age between 18 and 100',
                          validation_rules: { min: 18, max: 100 },
                          is_required: false,
                          display_order: 0,
                          created_at: '',
                          updated_at: ''
                        }}
                        value={testValues.age_field}
                        onChange={(value) => handleValueChange('age_field', value)}
                        error={validation.getError('age_field')}
                        onBlur={() => validation.touchField('age_field')}
                      />
                      <div className="text-xs p-2 bg-muted rounded">
                        <strong>Value:</strong> {testValues.age_field || '(empty)'}
                      </div>
                    </CardContent>
                  </Card>

                  {/* String Length Test */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">String Length Test</CardTitle>
                      <CardDescription className="text-xs">
                        Min 10, Max 200 characters
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <TextareaField
                        field={{
                          id: 'test-string-length',
                          platform_id: 'test',
                          field_key: 'bio_field',
                          field_type: 'textarea',
                          label: 'Bio (10-200 chars)',
                          placeholder: 'Enter at least 10 characters',
                          validation_rules: { minLength: 10, maxLength: 200 },
                          is_required: false,
                          display_order: 0,
                          created_at: '',
                          updated_at: ''
                        }}
                        value={testValues.bio_field}
                        onChange={(value) => handleValueChange('bio_field', value)}
                        error={validation.getError('bio_field')}
                        onBlur={() => validation.touchField('bio_field')}
                      />
                      <div className="text-xs p-2 bg-muted rounded">
                        <strong>Length:</strong> {testValues.bio_field?.length || 0} chars
                      </div>
                    </CardContent>
                  </Card>

                  {/* Email Validation Test */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Email Format Test</CardTitle>
                      <CardDescription className="text-xs">
                        Validates email format automatically
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <TextField
                        field={{
                          id: 'test-email',
                          platform_id: 'test',
                          field_key: 'email_field',
                          field_type: 'text',
                          label: 'Email Address',
                          placeholder: 'user@example.com',
                          is_required: false,
                          display_order: 0,
                          created_at: '',
                          updated_at: ''
                        }}
                        value={testValues.email_field}
                        onChange={(value) => handleValueChange('email_field', value)}
                        error={validation.getError('email_field')}
                        onBlur={() => validation.touchField('email_field')}
                      />
                      <div className="text-xs p-2 bg-muted rounded">
                        <strong>Value:</strong> {testValues.email_field || '(empty)'}
                      </div>
                    </CardContent>
                  </Card>

                  {/* URL Validation Test */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">URL Format Test</CardTitle>
                      <CardDescription className="text-xs">
                        Validates URL format automatically
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <TextField
                        field={{
                          id: 'test-url',
                          platform_id: 'test',
                          field_key: 'url_field',
                          field_type: 'text',
                          label: 'Website URL',
                          placeholder: 'https://example.com',
                          is_required: false,
                          display_order: 0,
                          created_at: '',
                          updated_at: ''
                        }}
                        value={testValues.url_field}
                        onChange={(value) => handleValueChange('url_field', value)}
                        error={validation.getError('url_field')}
                        onBlur={() => validation.touchField('url_field')}
                      />
                      <div className="text-xs p-2 bg-muted rounded">
                        <strong>Value:</strong> {testValues.url_field || '(empty)'}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Pattern Validation Test */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Pattern Test</CardTitle>
                      <CardDescription className="text-xs">
                        Must match: ABC-### (e.g., ABC-123)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <TextField
                        field={{
                          id: 'test-pattern',
                          platform_id: 'test',
                          field_key: 'pattern_field',
                          field_type: 'text',
                          label: 'Code Pattern',
                          placeholder: 'ABC-123',
                          validation_rules: { pattern: '^[A-Z]{3}-\\d{3}$' },
                          is_required: false,
                          display_order: 0,
                          created_at: '',
                          updated_at: ''
                        }}
                        value={testValues.pattern_field}
                        onChange={(value) => handleValueChange('pattern_field', value)}
                        error={validation.getError('pattern_field')}
                        onBlur={() => validation.touchField('pattern_field')}
                      />
                      <div className="text-xs p-2 bg-muted rounded">
                        <strong>Value:</strong> {testValues.pattern_field || '(empty)'}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Validation Summary */}
                <Card className="bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Validation Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Total Fields Tested:</span>
                        <Badge>6</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Fields with Errors:</span>
                        <Badge variant={validation.hasErrors() ? "destructive" : "default"}>
                          {Object.values(validation.validationResults).filter(r => !r.isValid).length}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Form Status:</span>
                        <Badge variant={validation.hasErrors() ? "destructive" : "default"}>
                          {validation.hasErrors() ? 'Invalid' : 'Valid'}
                        </Badge>
                      </div>
                    </div>

                    {/* Display all validation errors */}
                    <ValidationErrorList 
                      errors={getFormErrors(validation.validationResults)}
                      className="mt-4"
                    />
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            {/* DynamicFieldRenderer Demo */}
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>🎯 DynamicFieldRenderer Demo</span>
                  <Badge variant="outline">Phase 2.4</Badge>
                </CardTitle>
                <CardDescription>
                  Demonstrates the intelligent field renderer that automatically selects the correct component based on field type
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertDescription>
                    The DynamicFieldRenderer automatically renders the appropriate field component based on the <code className="px-1.5 py-0.5 bg-muted rounded">field_type</code> property. 
                    This is the core component that powers dynamic form generation from database configurations.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Demonstrate rendering all field types through DynamicFieldRenderer */}
                  {Object.entries(sampleFields)
                    .filter(([key]) => !key.includes('error')) // Only show main fields, not error state examples
                    .slice(0, 7) // First 7 fields (one of each type)
                    .map(([key, field]) => (
                      <Card key={key} className="border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">
                              {field.label}
                            </CardTitle>
                            <Badge variant="secondary" className="text-xs">
                              {field.field_type}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <DynamicFieldRenderer
                            field={field}
                            value={testValues[field.field_key]}
                            onChange={(value) => handleValueChange(field.field_key, value)}
                            error={validation.getError(field.field_key)}
                            onBlur={() => validation.touchField(field.field_key)}
                            allValues={testValues}
                          />
                          <div className="text-xs text-muted-foreground mt-2">
                            Rendered via DynamicFieldRenderer
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>

                {/* Benefits section */}
                <Card className="bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Key Benefits</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Automatic Routing:</strong> Renders correct component based on field_type</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Conditional Logic:</strong> Supports show/hide based on other field values</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Type Safe:</strong> Full TypeScript support with proper typing</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Memoized:</strong> Performance optimized with React.memo</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Fallback Handling:</strong> Gracefully handles unknown field types</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Unified Interface:</strong> Single component API for all field types</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            {/* DynamicFieldGroup Demo */}
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>📦 DynamicFieldGroup Demo</span>
                  <Badge variant="outline">Phase 2.4</Badge>
                </CardTitle>
                <CardDescription>
                  Renders multiple fields together with automatic sorting and flexible layout options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertDescription>
                    DynamicFieldGroup handles rendering multiple fields at once, automatically sorting by <code className="px-1.5 py-0.5 bg-muted rounded">display_order</code> and applying layout classes.
                  </AlertDescription>
                </Alert>

                {/* Vertical Layout Example */}
                <FieldSection
                  title="Vertical Layout"
                  description="Fields stacked vertically (default layout)"
                  collapsible
                  defaultOpen={true}
                >
                  <DynamicFieldGroup
                    fields={[
                      sampleFields.test_text,
                      sampleFields.test_number,
                      sampleFields.test_toggle
                    ]}
                    values={testValues}
                    onChange={handleValueChange}
                    errors={Object.fromEntries(
                      Object.entries(validation.validationResults).map(([key, result]) => [
                        key,
                        result.isValid ? undefined : result.errors
                      ])
                    )}
                    onBlur={(key) => validation.touchField(key)}
                    layout="vertical"
                  />
                </FieldSection>

                {/* Grid Layout Example */}
                <FieldSection
                  title="Grid Layout"
                  description="Two-column responsive grid layout"
                  collapsible
                  defaultOpen={true}
                >
                  <DynamicFieldGroup
                    fields={[
                      sampleFields.test_select,
                      sampleFields.test_slider,
                      sampleFields.test_textarea,
                      sampleFields.test_code
                    ]}
                    values={testValues}
                    onChange={handleValueChange}
                    errors={Object.fromEntries(
                      Object.entries(validation.validationResults).map(([key, result]) => [
                        key,
                        result.isValid ? undefined : result.errors
                      ])
                    )}
                    onBlur={(key) => validation.touchField(key)}
                    layout="grid"
                  />
                </FieldSection>

                {/* Features */}
                <Card className="bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">DynamicFieldGroup Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Auto-sorting:</strong> Sorts fields by display_order</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Layout Options:</strong> vertical, grid, two-column</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Responsive:</strong> Grid layouts adapt to mobile</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Error Handling:</strong> Passes validation errors to fields</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Unified API:</strong> Single onChange handler for all fields</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            {/* FieldSection Demo */}
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>📂 FieldSection Demo</span>
                  <Badge variant="outline">Phase 2.4</Badge>
                </CardTitle>
                <CardDescription>
                  Organizes fields into collapsible sections with titles and descriptions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertDescription>
                    FieldSection provides visual organization for field groups with optional collapse/expand functionality.
                  </AlertDescription>
                </Alert>

                {/* Collapsible Section Example */}
                <FieldSection
                  title="Basic Configuration"
                  description="Essential fields for prompt configuration"
                  collapsible={true}
                  defaultOpen={true}
                >
                  <DynamicFieldGroup
                    fields={[sampleFields.test_text, sampleFields.test_select]}
                    values={testValues}
                    onChange={handleValueChange}
                    errors={Object.fromEntries(
                      Object.entries(validation.validationResults).map(([key, result]) => [
                        key,
                        result.isValid ? undefined : result.errors
                      ])
                    )}
                    onBlur={(key) => validation.touchField(key)}
                    layout="vertical"
                  />
                </FieldSection>

                {/* Non-collapsible Section Example */}
                <FieldSection
                  title="Advanced Settings"
                  description="Fine-tune advanced parameters"
                  collapsible={false}
                >
                  <DynamicFieldGroup
                    fields={[sampleFields.test_slider, sampleFields.test_toggle]}
                    values={testValues}
                    onChange={handleValueChange}
                    errors={Object.fromEntries(
                      Object.entries(validation.validationResults).map(([key, result]) => [
                        key,
                        result.isValid ? undefined : result.errors
                      ])
                    )}
                    onBlur={(key) => validation.touchField(key)}
                    layout="grid"
                  />
                </FieldSection>

                {/* Another Collapsible Section */}
                <FieldSection
                  title="Code & Text"
                  description="Large text inputs and code fields"
                  collapsible={true}
                  defaultOpen={false}
                >
                  <DynamicFieldGroup
                    fields={[sampleFields.test_textarea, sampleFields.test_code]}
                    values={testValues}
                    onChange={handleValueChange}
                    errors={Object.fromEntries(
                      Object.entries(validation.validationResults).map(([key, result]) => [
                        key,
                        result.isValid ? undefined : result.errors
                      ])
                    )}
                    onBlur={(key) => validation.touchField(key)}
                    layout="vertical"
                  />
                </FieldSection>

                {/* Features */}
                <Card className="bg-muted/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">FieldSection Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Visual Organization:</strong> Groups related fields together</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Collapsible:</strong> Optional collapse/expand functionality</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Descriptions:</strong> Support for section descriptions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Default State:</strong> Control initial open/closed state</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">✓</span>
                        <span><strong>Flexible Content:</strong> Works with any child components</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            {/* Complete Form Example */}
            <Card className="border-2 border-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>🎨 Complete Form Example</span>
                  <Badge variant="outline" className="bg-green-500/10">All Components</Badge>
                </CardTitle>
                <CardDescription>
                  Real-world example combining DynamicFieldRenderer, DynamicFieldGroup, and FieldSection
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertDescription>
                    This demonstrates how all Phase 2 components work together to create a fully functional dynamic form system.
                  </AlertDescription>
                </Alert>

                {/* Complete Form with Sections */}
                <div className="space-y-6">
                  <FieldSection
                    title="🔧 Basic Settings"
                    description="Configure the fundamental parameters"
                    collapsible={true}
                    defaultOpen={true}
                  >
                    <DynamicFieldGroup
                      fields={[
                        sampleFields.test_text,
                        sampleFields.test_select,
                        sampleFields.test_number
                      ]}
                      values={testValues}
                      onChange={handleValueChange}
                      errors={Object.fromEntries(
                        Object.entries(validation.validationResults).map(([key, result]) => [
                          key,
                          result.isValid ? undefined : result.errors
                        ])
                      )}
                      onBlur={(key) => validation.touchField(key)}
                      layout="grid"
                    />
                  </FieldSection>

                  <FieldSection
                    title="⚙️ Advanced Configuration"
                    description="Fine-tune advanced parameters and toggles"
                    collapsible={true}
                    defaultOpen={true}
                  >
                    <DynamicFieldGroup
                      fields={[
                        sampleFields.test_slider,
                        sampleFields.test_toggle
                      ]}
                      values={testValues}
                      onChange={handleValueChange}
                      errors={Object.fromEntries(
                        Object.entries(validation.validationResults).map(([key, result]) => [
                          key,
                          result.isValid ? undefined : result.errors
                        ])
                      )}
                      onBlur={(key) => validation.touchField(key)}
                      layout="two-column"
                    />
                  </FieldSection>

                  <FieldSection
                    title="📝 Content & Code"
                    description="Large text areas and code editors"
                    collapsible={true}
                    defaultOpen={false}
                  >
                    <DynamicFieldGroup
                      fields={[
                        sampleFields.test_textarea,
                        sampleFields.test_code
                      ]}
                      values={testValues}
                      onChange={handleValueChange}
                      errors={Object.fromEntries(
                        Object.entries(validation.validationResults).map(([key, result]) => [
                          key,
                          result.isValid ? undefined : result.errors
                        ])
                      )}
                      onBlur={(key) => validation.touchField(key)}
                      layout="vertical"
                    />
                  </FieldSection>
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button 
                    onClick={() => {
                      const isValid = validation.validateAll(testValues);
                      const errorMessage = formatErrorsForToast(validation.validationResults);
                      
                      toast({
                        variant: isValid ? "default" : "destructive",
                        title: errorMessage.title,
                        description: errorMessage.description,
                      });
                    }}
                  >
                    Validate Form
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={validation.clearValidation}
                  >
                    Clear Validation
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={() => {
                      setTestValues({
                        test_text: '',
                        test_textarea: '',
                        test_number: 50,
                        test_select: '',
                        test_slider: 50,
                        test_toggle: false,
                        test_code: '',
                        required_field: '',
                        age_field: '',
                        bio_field: '',
                        email_field: '',
                        url_field: '',
                        pattern_field: '',
                      });
                      validation.clearValidation();
                    }}
                  >
                    Reset Form
                  </Button>
                </div>

                {/* Summary */}
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Phase 2 Complete! 🎉</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <p className="font-semibold">You now have a complete dynamic field system with:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <strong>Phase 2.1:</strong> Basic Fields
                          <ul className="text-xs text-muted-foreground ml-4 mt-1">
                            <li>• TextField</li>
                            <li>• TextareaField</li>
                            <li>• NumberField</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Phase 2.2:</strong> Advanced Fields
                          <ul className="text-xs text-muted-foreground ml-4 mt-1">
                            <li>• SelectField</li>
                            <li>• SliderField</li>
                            <li>• ToggleField</li>
                            <li>• CodeField</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Phase 2.3:</strong> Validation
                          <ul className="text-xs text-muted-foreground ml-4 mt-1">
                            <li>• Validation utilities</li>
                            <li>• Error formatting</li>
                            <li>• Validation hooks</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Phase 2.4:</strong> Orchestration
                          <ul className="text-xs text-muted-foreground ml-4 mt-1">
                            <li>• DynamicFieldRenderer</li>
                            <li>• DynamicFieldGroup</li>
                            <li>• FieldSection</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            {/* useDynamicForm Hook Demo */}
            <Card className="border-2 border-purple-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>🎣 useDynamicForm Hook Demo</span>
                  <Badge variant="outline" className="bg-purple-500/10">Phase 2.4</Badge>
                </CardTitle>
                <CardDescription>
                  Complete form management with built-in validation and state handling
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertDescription>
                    The <code className="px-1.5 py-0.5 bg-muted rounded">useDynamicForm</code> hook provides a complete solution for managing dynamic forms, including state, validation, submission, and reset functionality.
                  </AlertDescription>
                </Alert>

                {/* Demo Form Using useDynamicForm */}
                {(() => {
                  // Create a separate form instance for this demo
                  const demoFields = [
                    sampleFields.test_text,
                    sampleFields.test_select,
                    sampleFields.test_number,
                    sampleFields.test_toggle
                  ];

                  const form = useDynamicForm({
                    fields: demoFields,
                    initialValues: {
                      test_text: 'Initial value',
                      test_select: 'opt2',
                      test_number: 50,
                      test_toggle: true
                    },
                    onSubmit: async (values) => {
                      // Simulate API call
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      toast({
                        title: 'Form Submitted!',
                        description: `Values: ${JSON.stringify(values, null, 2)}`
                      });
                    }
                  });

                  return (
                    <div className="space-y-6">
                      {/* Form Status */}
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant={form.hasErrors ? "destructive" : "default"}>
                          {form.hasErrors ? '✗ Has Errors' : '✓ Valid'}
                        </Badge>
                        <Badge variant={form.isDirty ? "secondary" : "outline"}>
                          {form.isDirty ? '📝 Modified' : '✓ Saved'}
                        </Badge>
                        <Badge variant={form.isSubmitting ? "default" : "outline"}>
                          {form.isSubmitting ? '⏳ Submitting...' : '🎯 Ready'}
                        </Badge>
                      </div>

                      {/* Form Fields */}
                      <form onSubmit={form.handleSubmit} className="space-y-6">
                        <FieldSection
                          title="Demo Form"
                          description="Managed by useDynamicForm hook"
                          collapsible={false}
                        >
                          <DynamicFieldGroup
                            fields={demoFields}
                            values={form.values}
                            onChange={form.setValue}
                            errors={Object.fromEntries(
                              demoFields.map(field => [
                                field.field_key,
                                form.getError(field.field_key)
                              ])
                            )}
                            onBlur={form.handleBlur}
                            layout="grid"
                          />
                        </FieldSection>

                        {/* Form Actions */}
                        <div className="flex gap-3 pt-4 border-t">
                          <Button 
                            type="submit" 
                            disabled={form.isSubmitting}
                          >
                            {form.isSubmitting ? 'Submitting...' : 'Submit Form'}
                          </Button>
                          <Button 
                            type="button"
                            variant="outline"
                            onClick={form.reset}
                            disabled={form.isSubmitting}
                          >
                            Reset Form
                          </Button>
                          <Button 
                            type="button"
                            variant="secondary"
                            onClick={() => form.validateAll()}
                            disabled={form.isSubmitting}
                          >
                            Validate All
                          </Button>
                        </div>
                      </form>

                      {/* Current Values Display */}
                      <Card className="bg-muted/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Current Form State</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs bg-background p-3 rounded overflow-auto max-h-40">
                            {JSON.stringify(form.values, null, 2)}
                          </pre>
                        </CardContent>
                      </Card>

                      {/* Hook Features */}
                      <Card className="bg-muted/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">useDynamicForm Features</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">✓</span>
                              <span><strong>State Management:</strong> Handles all form values automatically</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">✓</span>
                              <span><strong>Default Values:</strong> Parses field defaults by type</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">✓</span>
                              <span><strong>Validation:</strong> Built-in validation integration</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">✓</span>
                              <span><strong>Submission:</strong> Async submit handler with loading state</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">✓</span>
                              <span><strong>Dirty Tracking:</strong> Detects unsaved changes</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">✓</span>
                              <span><strong>Reset:</strong> One-click form reset functionality</span>
                            </li>
                          </ul>
                        </CardContent>
                      </Card>

                      {/* Code Example */}
                      <Card className="bg-muted/50">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">Code Example</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <pre className="text-xs bg-background p-3 rounded overflow-auto">
{`const form = useDynamicForm({
  fields: platformFields,
  initialValues: { name: 'John' },
  onSubmit: async (values) => {
    await saveToDatabase(values);
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
    <button disabled={form.isSubmitting}>
      Submit
    </button>
  </form>
);`}
                          </pre>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

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
import { TextField, TextareaField, NumberField, SelectField, SliderField, ToggleField, CodeField } from '@/components/prompts/fields';
import { useFieldValidation, formatErrorsForToast, hasErrors } from '@/lib/validation';
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
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

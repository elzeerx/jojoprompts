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
import type { PlatformField } from '@/types/platform';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export default function PlatformTest() {
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('');
  
  // Test field values
  const [testValues, setTestValues] = useState<Record<string, any>>({
    test_text: '',
    test_textarea: '',
    test_number: 50,
    test_text_error: '',
    test_textarea_error: '',
    test_number_error: 150,
    test_select: '',
    test_slider: 50,
    test_toggle: false,
    test_code: '',
    test_select_error: '',
    test_slider_error: 150,
    test_toggle_error: false,
    test_code_error: '{"invalid": json}',
  });

  // Test error states
  const [showErrors, setShowErrors] = useState(false);
  
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

  const handleValueChange = (key: string, value: any) => {
    setTestValues(prev => ({ ...prev, [key]: value }));
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
            <CardTitle>Field Components Test</CardTitle>
            <CardDescription>
              Test the TextField, TextareaField, and NumberField components with live interactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Controls */}
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <Button 
                onClick={() => setShowErrors(!showErrors)}
                variant={showErrors ? "destructive" : "default"}
              >
                {showErrors ? 'Hide' : 'Show'} Error States
              </Button>
              <Button 
                onClick={() => setTestValues({
                  test_text: 'Sample text',
                  test_textarea: 'This is a longer sample text that demonstrates the textarea component with multiple lines of content.',
                  test_number: 75,
                  test_text_error: '',
                  test_textarea_error: '',
                  test_number_error: 150,
                  test_select: 'opt2',
                  test_slider: 75,
                  test_toggle: true,
                  test_code: '{\n  "key": "value",\n  "array": [1, 2, 3]\n}',
                  test_select_error: '',
                  test_slider_error: 150,
                  test_toggle_error: false,
                  test_code_error: '{"invalid": json}',
                })}
                variant="secondary"
              >
                Fill Sample Data
              </Button>
              <Button 
                onClick={() => setTestValues({
                  test_text: '',
                  test_textarea: '',
                  test_number: 50,
                  test_text_error: '',
                  test_textarea_error: '',
                  test_number_error: 150,
                  test_select: '',
                  test_slider: 50,
                  test_toggle: false,
                  test_code: '',
                  test_select_error: '',
                  test_slider_error: 150,
                  test_toggle_error: false,
                  test_code_error: '{"invalid": json}',
                })}
                variant="outline"
              >
                Reset Fields
              </Button>
            </div>

            {/* Normal Fields */}
            <div className="space-y-6 border-t pt-6">
              <h3 className="text-lg font-semibold">Basic Input Fields</h3>
              
              <TextField
                field={sampleFields.test_text}
                value={testValues.test_text}
                onChange={(value) => handleValueChange('test_text', value)}
              />

              <TextareaField
                field={sampleFields.test_textarea}
                value={testValues.test_textarea}
                onChange={(value) => handleValueChange('test_textarea', value)}
              />

              <NumberField
                field={sampleFields.test_number}
                value={testValues.test_number}
                onChange={(value) => handleValueChange('test_number', value)}
              />
            </div>

            {/* Advanced Fields */}
            <div className="space-y-6 border-t pt-6">
              <h3 className="text-lg font-semibold">Advanced Input Fields</h3>
              
              <SelectField
                field={sampleFields.test_select}
                value={testValues.test_select}
                onChange={(value) => handleValueChange('test_select', value)}
              />

              <SliderField
                field={sampleFields.test_slider}
                value={testValues.test_slider}
                onChange={(value) => handleValueChange('test_slider', value)}
              />

              <ToggleField
                field={sampleFields.test_toggle}
                value={testValues.test_toggle}
                onChange={(value) => handleValueChange('test_toggle', value)}
              />

              <CodeField
                field={sampleFields.test_code}
                value={testValues.test_code}
                onChange={(value) => handleValueChange('test_code', value)}
              />
            </div>

            {/* Error State Fields */}
            <div className="space-y-6 border-t pt-6">
              <h3 className="text-lg font-semibold">Error State Fields</h3>
              
              <TextField
                field={sampleFields.test_text_error}
                value={testValues.test_text_error}
                onChange={(value) => handleValueChange('test_text_error', value)}
                error={showErrors ? 'This field is required' : undefined}
              />

              <TextareaField
                field={sampleFields.test_textarea_error}
                value={testValues.test_textarea_error}
                onChange={(value) => handleValueChange('test_textarea_error', value)}
                error={showErrors ? 'Text is too long (max 200 characters)' : undefined}
              />

              <NumberField
                field={sampleFields.test_number_error}
                value={testValues.test_number_error}
                onChange={(value) => handleValueChange('test_number_error', value)}
                error={showErrors ? 'Value must be between 0 and 100' : undefined}
              />

              <SelectField
                field={sampleFields.test_select_error}
                value={testValues.test_select_error}
                onChange={(value) => handleValueChange('test_select_error', value)}
                error={showErrors ? 'Please select an option' : undefined}
              />

              <SliderField
                field={sampleFields.test_slider_error}
                value={testValues.test_slider_error}
                onChange={(value) => handleValueChange('test_slider_error', value)}
                error={showErrors ? 'Value exceeds maximum (100)' : undefined}
              />

              <ToggleField
                field={sampleFields.test_toggle_error}
                value={testValues.test_toggle_error}
                onChange={(value) => handleValueChange('test_toggle_error', value)}
                error={showErrors ? 'This option must be enabled' : undefined}
              />

              <CodeField
                field={sampleFields.test_code_error}
                value={testValues.test_code_error}
                onChange={(value) => handleValueChange('test_code_error', value)}
                error={showErrors ? 'Invalid JSON syntax' : undefined}
              />
            </div>

            {/* Current Values Display */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold">Current Field Values</h3>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(testValues, null, 2)}
                </pre>
              </div>
            </div>

            {/* Feature Checklist */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-semibold">Component Features Checklist</h3>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>TextField component</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>TextareaField component</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>NumberField component</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>SelectField component</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>SliderField component</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>ToggleField component</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>CodeField component</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>Required field indicators</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>Help text tooltips</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>Error message display</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>Placeholder text</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>Character counter</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>Min/Max validation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>JSON validation</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>Value change handling</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">✓</Badge>
                  <span>Accessible ARIA labels</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Testing Summary */}
        <Card className="bg-muted">
          <CardHeader>
            <CardTitle>Test Results Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${platforms && platforms.length > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">
                  Platforms Loaded: {platforms?.length || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${platformWithFields && platformWithFields.fields.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm">
                  Fields Loaded: {platformWithFields?.fields.length || 0} 
                  {selectedPlatformId ? ` (${platformWithFields?.name || 'Loading...'})` : ' (Select a platform)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${!platformsError && !fieldsError ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">
                  No Errors: {!platformsError && !fieldsError ? 'Pass ✓' : 'Fail ✗'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

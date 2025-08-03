import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { HelpCircle, AlertCircle, CheckCircle } from 'lucide-react';
import { 
  ALL_PROMPT_TYPES, 
  getPromptTypeById, 
  validatePromptData,
  type ModelPromptType,
  type PromptField 
} from '@/utils/promptTypes';
import { RichTextEditor } from './RichTextEditor';
import { DragDropUpload } from './DragDropUpload';
import { usePromptValidation } from '@/utils/promptValidation';
import { usePromptAutoSave } from '@/hooks/useAutoSave';

interface ModelSpecificPromptFormProps {
  value: any;
  onChange: (value: any) => void;
  onValidationChange?: (isValid: boolean, errors: Record<string, string>) => void;
  className?: string;
  disabled?: boolean;
}

export function ModelSpecificPromptForm({
  value,
  onChange,
  onValidationChange,
  className,
  disabled = false
}: ModelSpecificPromptFormProps) {
  const [selectedPromptType, setSelectedPromptType] = useState<ModelPromptType | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTips, setShowTips] = useState(false);

  // Auto-save functionality
  const autoSave = usePromptAutoSave(formData, {
    onRestore: (data) => {
      setFormData(data);
      onChange(data);
    }
  });

  // Validation
  const validation = usePromptValidation(formData, { checkQuality: true });

  // Update form data when value changes
  useEffect(() => {
    if (value) {
      setFormData(value);
    }
  }, [value]);

  // Update parent when form data changes
  useEffect(() => {
    if (Object.keys(formData).length > 0) {
      onChange(formData);
    }
  }, [formData, onChange]);

  // Update validation state
  useEffect(() => {
    const isValid = Object.keys(errors).length === 0 && validation.isValid;
    onValidationChange?.(isValid, errors);
  }, [errors, validation.isValid, onValidationChange]);

  // Handle prompt type selection
  const handlePromptTypeChange = (promptTypeId: string) => {
    console.log('Selecting prompt type:', promptTypeId);
    const promptType = getPromptTypeById(promptTypeId);
    console.log('Found prompt type:', promptType);
    if (promptType && promptType.fields) {
      setSelectedPromptType(promptType);
      
      // Initialize form data with default values
      const initialData: any = {
        promptType: promptTypeId,
        metadata: {
          category: promptType.category
        }
      };

      // Set default values for fields
      promptType.fields.forEach(field => {
        if (field.defaultValue !== undefined) {
          initialData[field.id] = field.defaultValue;
        }
      });

      setFormData(initialData);
      setErrors({});
    } else {
      console.error('Prompt type not found or missing fields:', promptTypeId, promptType);
    }
  };

  // Handle field change
  const handleFieldChange = (fieldId: string, fieldValue: any) => {
    // Handle both event objects and direct values
    let value = fieldValue;
    if (fieldValue && typeof fieldValue === 'object' && fieldValue.target) {
      value = fieldValue.target.value;
    }
    
    const updatedData = {
      ...formData,
      [fieldId]: value
    };
    setFormData(updatedData);

    // Validate the field
    if (selectedPromptType && selectedPromptType.fields) {
      const fieldErrors = validatePromptData(updatedData, selectedPromptType);
      setErrors(fieldErrors);
    }
  };

  // Handle metadata change
  const handleMetadataChange = (metadata: any) => {
    const updatedData = {
      ...formData,
      metadata: {
        ...formData.metadata,
        ...metadata
      }
    };
    setFormData(updatedData);
  };

  // Render field based on type
  const renderField = (field: PromptField) => {
    const fieldValue = formData[field.id];
    const fieldError = errors[field.id];
    const isRequired = field.required;

    const commonProps = {
      id: field.id,
      value: fieldValue || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => handleFieldChange(field.id, e.target.value),
      placeholder: field.placeholder,
      disabled: disabled,
      className: fieldError ? 'border-red-500' : ''
    };

    switch (field.type) {
      case 'text':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="flex items-center gap-2">
              {field.name}
              {isRequired && <span className="text-red-500">*</span>}
              {field.help && (
                <HelpCircle className="h-4 w-4 text-gray-400" title={field.help} />
              )}
            </Label>
            <Input {...commonProps} />
            {fieldError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{fieldError}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="flex items-center gap-2">
              {field.name}
              {isRequired && <span className="text-red-500">*</span>}
              {field.help && (
                <HelpCircle className="h-4 w-4 text-gray-400" title={field.help} />
              )}
            </Label>
            <Textarea {...commonProps} rows={4} />
            {fieldError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{fieldError}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="flex items-center gap-2">
              {field.name}
              {isRequired && <span className="text-red-500">*</span>}
              {field.help && (
                <HelpCircle className="h-4 w-4 text-gray-400" title={field.help} />
              )}
            </Label>
            <Select
              value={fieldValue || ''}
              onValueChange={(value) => handleFieldChange(field.id, value)}
              disabled={disabled}
            >
              <SelectTrigger className={fieldError ? 'border-red-500' : ''}>
                <SelectValue placeholder={field.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{fieldError}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 'multiselect':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="flex items-center gap-2">
              {field.name}
              {isRequired && <span className="text-red-500">*</span>}
              {field.help && (
                <HelpCircle className="h-4 w-4 text-gray-400" title={field.help} />
              )}
            </Label>
            <div className="space-y-2">
              {field.options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-${option.value}`}
                    checked={fieldValue?.includes(option.value) || false}
                    onCheckedChange={(checked) => {
                      const currentValues = fieldValue || [];
                      const newValues = checked
                        ? [...currentValues, option.value]
                        : currentValues.filter((v: string) => v !== option.value);
                      handleFieldChange(field.id, newValues);
                    }}
                    disabled={disabled}
                  />
                  <Label htmlFor={`${field.id}-${option.value}`}>{option.label}</Label>
                </div>
              ))}
            </div>
            {fieldError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{fieldError}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="flex items-center gap-2">
              {field.name}
              {isRequired && <span className="text-red-500">*</span>}
              {field.help && (
                <HelpCircle className="h-4 w-4 text-gray-400" title={field.help} />
              )}
            </Label>
            <Input
              {...commonProps}
              type="number"
              min={field.validation?.minLength}
              max={field.validation?.maxLength}
            />
            {fieldError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{fieldError}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div key={field.id} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={field.id}
                checked={fieldValue || false}
                onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
                disabled={disabled}
              />
              <Label htmlFor={field.id} className="flex items-center gap-2">
                {field.name}
                {isRequired && <span className="text-red-500">*</span>}
                {field.help && (
                  <HelpCircle className="h-4 w-4 text-gray-400" title={field.help} />
                )}
              </Label>
            </div>
            {fieldError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{fieldError}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      case 'json':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id} className="flex items-center gap-2">
              {field.name}
              {isRequired && <span className="text-red-500">*</span>}
              {field.help && (
                <HelpCircle className="h-4 w-4 text-gray-400" title={field.help} />
              )}
            </Label>
            <Textarea
              {...commonProps}
              rows={8}
              placeholder="Enter JSON configuration..."
            />
            {fieldError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{fieldError}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={className}>
      {/* Prompt Type Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Prompt Type</CardTitle>
          <CardDescription>
            Choose the type of prompt you want to create
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_PROMPT_TYPES.map((promptType) => (
              <Card
                key={promptType.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedPromptType?.id === promptType.id
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : ''
                }`}
                onClick={() => handlePromptTypeChange(promptType.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: promptType.color }}
                    />
                    <div>
                      <h3 className="font-medium">{promptType.name}</h3>
                      <p className="text-sm text-gray-600">{promptType.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Form */}
      {selectedPromptType && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedPromptType.name}</CardTitle>
                <CardDescription>{selectedPromptType.description}</CardDescription>
              </div>
              <Badge variant="outline" style={{ backgroundColor: selectedPromptType.color + '20' }}>
                {selectedPromptType.category}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Form Fields */}
            <div className="space-y-4">
              {/* Title Field - Always required */}
              <div className="space-y-2">
                <Label htmlFor="title" className="flex items-center gap-2">
                  Prompt Title
                  <span className="text-red-500">*</span>
                  <HelpCircle className="h-4 w-4 text-gray-400" title="Give your prompt a descriptive title" />
                </Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder="Enter a descriptive title for your prompt..."
                  disabled={disabled}
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.title}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Dynamic Fields from Prompt Type */}
              {selectedPromptType.fields && selectedPromptType.fields.map(renderField)}
            </div>

            {/* Tips Section */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Tips & Examples</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTips(!showTips)}
                >
                  {showTips ? 'Hide' : 'Show'} Tips
                </Button>
              </div>
              
              {showTips && (
                <div className="space-y-4">
                  <div>
                    <h5 className="font-medium text-sm mb-2">Examples:</h5>
                    <ul className="space-y-1 text-sm text-gray-600">
                      {selectedPromptType.examples && selectedPromptType.examples.map((example, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-blue-500">•</span>
                          <span>{example}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-sm mb-2">Tips:</h5>
                    <ul className="space-y-1 text-sm text-gray-600">
                      {selectedPromptType.tips && selectedPromptType.tips.map((tip, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Auto-save Status */}
            {autoSave.isSaving && (
              <Alert>
                <AlertDescription className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  Auto-saving...
                </AlertDescription>
              </Alert>
            )}

            {/* Validation Summary */}
            {!validation.isValid && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please fix the validation errors above
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
} 
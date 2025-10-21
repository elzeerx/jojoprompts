import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Info } from "lucide-react";
import { ModelPromptType, PromptField } from "@/utils/promptTypes";

interface DynamicFormRendererProps {
  template: ModelPromptType;
  formData: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  errors?: Record<string, string>;
}

export function DynamicFormRenderer({ template, formData, onChange, errors }: DynamicFormRendererProps) {
  
  const renderField = (field: PromptField) => {
    const value = formData[field.id] || field.defaultValue || '';
    const error = errors?.[field.id];

    const renderInput = () => {
      switch (field.type) {
        case 'text':
          return (
            <Input
              id={field.id}
              value={value}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className={error ? 'border-red-500' : ''}
            />
          );

        case 'textarea':
          return (
            <Textarea
              id={field.id}
              value={value}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              rows={4}
              className={`resize-none ${error ? 'border-red-500' : ''}`}
            />
          );

        case 'select':
          return (
            <Select 
              value={value} 
              onValueChange={(newValue) => onChange(field.id, newValue)}
            >
              <SelectTrigger className={error ? 'border-red-500' : ''}>
                <SelectValue placeholder={field.placeholder || `Select ${field.name.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );

        case 'multiselect':
          const selectedValues = Array.isArray(value) ? value : [];
          return (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {field.options?.map((option) => (
                  <div
                    key={option.value}
                    className={`p-2 border rounded cursor-pointer transition-colors ${
                      selectedValues.includes(option.value)
                        ? 'bg-[var(--warm-gold)]/10 border-[var(--warm-gold)]'
                        : 'border-border hover:border-[var(--warm-gold)]/50'
                    }`}
                    onClick={() => {
                      const newValues = selectedValues.includes(option.value)
                        ? selectedValues.filter(v => v !== option.value)
                        : [...selectedValues, option.value];
                      onChange(field.id, newValues);
                    }}
                  >
                    <span className="text-sm">{option.label}</span>
                  </div>
                ))}
              </div>
              {selectedValues.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedValues.map((val) => {
                    const option = field.options?.find(opt => opt.value === val);
                    return option ? (
                      <Badge key={val} variant="secondary" className="text-xs">
                        {option.label}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          );

        case 'number':
          return (
            <Input
              id={field.id}
              type="number"
              value={value}
              onChange={(e) => onChange(field.id, parseFloat(e.target.value) || 0)}
              placeholder={field.placeholder}
              min={field.validation?.minLength}
              max={field.validation?.maxLength}
              className={error ? 'border-red-500' : ''}
            />
          );

        case 'boolean':
          return (
            <div className="flex items-center space-x-2">
              <Switch
                id={field.id}
                checked={Boolean(value)}
                onCheckedChange={(checked) => onChange(field.id, checked)}
              />
              <Label htmlFor={field.id} className="text-sm">
                {field.placeholder || `Enable ${field.name}`}
              </Label>
            </div>
          );

        case 'json':
          return (
            <Textarea
              id={field.id}
              value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  onChange(field.id, parsed);
                } catch {
                  onChange(field.id, e.target.value);
                }
              }}
              placeholder={field.placeholder}
              rows={6}
              className={`font-mono text-sm resize-none ${error ? 'border-red-500' : ''}`}
            />
          );

        default:
          return null;
      }
    };

    return (
      <div key={field.id} className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={field.id} className="text-sm font-medium flex items-center gap-2">
            {field.name}
            {field.required && <span className="text-red-500">*</span>}
          </Label>
          {field.help && (
            <div className="group relative">
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              <div className="absolute right-0 top-6 w-64 p-2 bg-popover border rounded-md shadow-lg text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                {field.help}
              </div>
            </div>
          )}
        </div>
        
        {renderInput()}
        
        {error && (
          <div className="flex items-center gap-1 text-red-500 text-xs">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
        <div 
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: template.color || 'hsl(var(--warm-gold))' }}
        />
        <div>
          <h4 className="font-semibold text-foreground">{template.name}</h4>
          <p className="text-sm text-muted-foreground">{template.description}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {template.fields.map(renderField)}
      </div>

      {template.tips && template.tips.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h5 className="font-medium text-blue-900 mb-2">💡 Tips for better results:</h5>
          <ul className="text-sm text-blue-800 space-y-1">
            {template.tips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2">
                <span>•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
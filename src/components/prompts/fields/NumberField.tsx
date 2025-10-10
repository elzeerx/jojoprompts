import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InfoIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FieldComponentProps } from './types';
import { cn } from '@/lib/utils';

export function NumberField({ 
  field, 
  value, 
  onChange, 
  error, 
  disabled, 
  className, 
  onBlur, 
  onFocus 
}: FieldComponentProps) {
  const hasError = !!error;
  const errorMessage = Array.isArray(error) ? error[0] : error;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow empty string or valid number
    if (val === '') {
      onChange(null);
    } else {
      const numValue = parseFloat(val);
      if (!isNaN(numValue)) {
        onChange(numValue);
      }
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label with optional help text tooltip */}
      <div className="flex items-center gap-2">
        <Label htmlFor={field.field_key} className="text-sm font-medium">
          {field.label}
          {field.is_required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {field.help_text && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{field.help_text}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Number input field */}
      <Input
        id={field.field_key}
        type="number"
        value={value ?? ''}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={field.placeholder}
        disabled={disabled}
        min={field.validation_rules?.min}
        max={field.validation_rules?.max}
        step={field.validation_rules?.step || 1}
        className={cn(hasError && "border-destructive focus-visible:ring-destructive")}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${field.field_key}-error` : undefined}
      />

      {/* Error message */}
      {hasError && (
        <p id={`${field.field_key}-error`} className="text-sm text-destructive flex items-center gap-1">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

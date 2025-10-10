import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { InfoIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FieldComponentProps } from './types';
import { cn } from '@/lib/utils';

export function SliderField({ 
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
  
  const min = field.validation_rules?.min ?? 0;
  const max = field.validation_rules?.max ?? 100;
  const step = field.validation_rules?.step ?? 1;
  
  const currentValue = value ?? min;

  const handleValueChange = (newValue: number[]) => {
    onChange(newValue[0]);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label with value and help text */}
      <div className="flex items-center justify-between">
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
        <span className="text-sm font-semibold">{currentValue}</span>
      </div>

      {/* Slider with min/max labels */}
      <div className="space-y-1">
        <Slider
          id={field.field_key}
          value={[currentValue]}
          onValueChange={handleValueChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className={cn(hasError && "opacity-75")}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${field.field_key}-error` : undefined}
        />

        {/* Min/Max labels */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>

      {/* Error message */}
      {hasError && (
        <p id={`${field.field_key}-error`} className="text-sm text-destructive flex items-center gap-1">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { InfoIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FieldComponentProps } from './types';
import { cn } from '@/lib/utils';

export function ToggleField({ 
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
  
  const isChecked = value === true || value === 'true' || value === 1;

  const handleChange = (checked: boolean) => {
    onChange(checked);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Toggle with label */}
      <div className="flex items-center justify-between space-x-4 p-4 border rounded-lg bg-card">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Label htmlFor={field.field_key} className="text-sm font-medium cursor-pointer">
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
          {field.placeholder && (
            <p className="text-sm text-muted-foreground">
              {field.placeholder}
            </p>
          )}
        </div>
        
        <Switch
          id={field.field_key}
          checked={isChecked}
          onCheckedChange={handleChange}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${field.field_key}-error` : undefined}
          onBlur={onBlur}
          onFocus={onFocus}
        />
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

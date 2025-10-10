import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { InfoIcon, Code2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FieldComponentProps } from './types';
import { cn } from '@/lib/utils';

export function CodeField({ 
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
  const maxLength = field.validation_rules?.max;
  const currentLength = value?.length || 0;

  // Validate JSON if needed
  const validateJSON = (text: string) => {
    if (!text) return null;
    try {
      JSON.parse(text);
      return null;
    } catch (e) {
      return 'Invalid JSON format';
    }
  };

  const jsonError = field.placeholder?.toLowerCase().includes('json') ? validateJSON(value) : null;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label with optional help text tooltip */}
      <div className="flex items-center gap-2">
        <Code2 className="h-4 w-4 text-muted-foreground" />
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

      {/* Code textarea with monospace font */}
      <Textarea
        id={field.field_key}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={field.placeholder || 'Enter code...'}
        disabled={disabled}
        maxLength={maxLength}
        className={cn(
          "min-h-[200px] font-mono text-sm",
          hasError && "border-destructive focus-visible:ring-destructive"
        )}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${field.field_key}-error` : undefined}
        rows={field.validation_rules?.min || 8}
        spellCheck={false}
      />

      {/* Character count and JSON validation */}
      <div className="flex items-center justify-between text-xs">
        {maxLength && (
          <p className="text-muted-foreground">
            {currentLength}/{maxLength} characters
          </p>
        )}
        {jsonError && !hasError && (
          <p className="text-yellow-600 dark:text-yellow-500">
            ⚠️ {jsonError}
          </p>
        )}
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

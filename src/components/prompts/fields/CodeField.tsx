import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { InfoIcon, Code2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FieldComponentProps } from './types';
import { cn } from '@/lib/utils';
import { createLogger } from '@/utils/logging';

const logger = createLogger('CODE_FIELD');

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
  const currentValue = value || '';
  const lineCount = currentValue.split('\n').length;

  const handleFormatJSON = () => {
    try {
      const formatted = JSON.stringify(JSON.parse(currentValue), null, 2);
      onChange(formatted);
    } catch (e) {
      // If not valid JSON, do nothing
      logger.debug('Invalid JSON format', { fieldKey: field.field_key });
    }
  };

  const looksLikeJSON = currentValue.trim().startsWith('{') || currentValue.trim().startsWith('[');

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label with help text and format button */}
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

        {looksLikeJSON && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleFormatJSON}
            disabled={disabled}
            className="h-7"
          >
            <Code2 className="h-3 w-3 mr-1" />
            Format JSON
          </Button>
        )}
      </div>

      {/* Code textarea */}
      <Textarea
        id={field.field_key}
        value={currentValue}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={field.placeholder || "Paste your code here..."}
        disabled={disabled}
        className={cn(
          "font-mono text-sm min-h-[200px] resize-y",
          hasError && "border-destructive focus-visible:ring-destructive"
        )}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${field.field_key}-error` : undefined}
        spellCheck={false}
      />

      {/* Line count */}
      <p className="text-xs text-muted-foreground text-right">
        {lineCount} {lineCount === 1 ? 'line' : 'lines'}
      </p>

      {/* Error message */}
      {hasError && (
        <p id={`${field.field_key}-error`} className="text-sm text-destructive flex items-center gap-1">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

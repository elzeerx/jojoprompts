import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

interface ValidationErrorListProps {
  errors: string[];
  className?: string;
}

/**
 * Displays a list of validation errors in an alert component
 * Returns null if there are no errors to display
 * RTL-aware with proper mobile overflow handling
 */
export function ValidationErrorList({ errors, className }: ValidationErrorListProps) {
  const { isRTL } = useTranslation();
  
  if (errors.length === 0) return null;

  return (
    <Alert variant="destructive" className={cn("max-w-full", className)}>
      <AlertCircle className={cn("h-4 w-4 flex-shrink-0", isRTL ? "ml-2" : "mr-2")} />
      <AlertDescription className="flex-1 min-w-0">
        <ul className={cn(
          "space-y-1",
          isRTL ? "list-disc list-inside pr-4" : "list-disc list-inside pl-4"
        )}>
          {errors.map((error, index) => (
            <li 
              key={index}
              className="break-words overflow-wrap-anywhere leading-relaxed text-sm"
            >
              {error}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

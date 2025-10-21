import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ValidationErrorListProps {
  errors: string[];
  className?: string;
}

/**
 * Displays a list of validation errors in an alert component
 * Returns null if there are no errors to display
 */
export function ValidationErrorList({ errors, className }: ValidationErrorListProps) {
  if (errors.length === 0) return null;

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <ul className="list-disc list-inside space-y-1">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}


import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface UsersErrorProps {
  error: string;
  onRetry: () => void;
}

export function UsersError({ error, onRetry }: UsersErrorProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription className="flex items-center gap-2">
        {error}
        {error.includes("admin privileges") && (
          <Button 
            variant="link" 
            className="p-0 h-auto text-destructive-foreground hover:text-destructive-foreground/80"
            onClick={onRetry}
          >
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}


import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface UsersErrorProps {
  error: string;
  onRetry: () => void;
}

export function UsersError({ error, onRetry }: UsersErrorProps) {
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error Loading Users</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <p className="mt-1">{error}</p>
        <div className="flex justify-end mt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="flex items-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Loading Users
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

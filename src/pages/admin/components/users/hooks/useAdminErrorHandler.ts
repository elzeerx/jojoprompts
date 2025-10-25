import { toast } from "@/hooks/use-toast";
import { createLogger } from '@/utils/logging';

const logger = createLogger('ADMIN_ERROR_HANDLER');

export interface AdminError {
  message: string;
  details?: string;
  code?: string;
  status?: number;
}

export function useAdminErrorHandler() {
  const handleError = (error: any, operation: string = "operation") => {
    logger.error('Admin operation failed', { operation, error: error.message || error });
    
    let errorMessage = `Failed to ${operation}`;
    let errorDetails = "An unexpected error occurred";
    
    // Handle edge function errors
    if (error?.message) {
      if (error.message.includes("Edge Function returned a non-2xx status code")) {
        errorMessage = `Server error during ${operation}`;
        errorDetails = "The admin function returned an error. Please check your permissions and try again.";
      } else if (error.message.includes("Invalid or expired token")) {
        errorMessage = "Authentication failed";
        errorDetails = "Your session has expired. Please refresh the page and try again.";
      } else if (error.message.includes("Insufficient permissions")) {
        errorMessage = "Permission denied";
        errorDetails = "You don't have the required permissions for this action.";
      } else {
        errorDetails = error.message;
      }
    } else if (typeof error === "string") {
      errorDetails = error;
    }
    
    toast({
      title: errorMessage,
      description: errorDetails,
      variant: "destructive",
    });
    
    return {
      message: errorMessage,
      details: errorDetails
    };
  };
  
  return { handleError };
}
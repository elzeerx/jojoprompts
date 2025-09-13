import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAdminErrorHandler } from "./useAdminErrorHandler";

interface BulkOperationData {
  operation: 'bulk-delete' | 'bulk-update' | 'bulk-role-change';
  userIds: string[];
  updates?: {
    role?: string;
    [key: string]: any;
  };
}

export function useBulkUserOperations() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { handleError } = useAdminErrorHandler();

  const processBulkOperation = async (operationData: BulkOperationData) => {
    try {
      setIsProcessing(true);
      
      // Use edge function for bulk operations
      const { data, error } = await supabase.functions.invoke(
        "get-all-users",
        {
          body: operationData
        }
      );
      
      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Failed to invoke bulk operation function");
      }
      
      if (data?.error) {
        throw new Error(data.error || "Failed to process bulk operation");
      }
      
      if (!data?.success) {
        throw new Error("Bulk operation failed");
      }
      
      // Show detailed results
      const { summary, errors } = data;
      
      if (summary.failed > 0) {
        toast({
          title: "Partial Success",
          description: `${summary.successful}/${summary.total} operations completed successfully. ${summary.failed} failed.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: `All ${summary.successful} operations completed successfully`,
        });
      }
      
      return data;
    } catch (error: any) {
      handleError(error, "process bulk operation");
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const bulkDelete = async (userIds: string[]) => {
    return processBulkOperation({
      operation: 'bulk-delete',
      userIds
    });
  };

  const bulkRoleChange = async (userIds: string[], newRole: string) => {
    return processBulkOperation({
      operation: 'bulk-role-change',
      userIds,
      updates: { role: newRole }
    });
  };

  const bulkUpdate = async (userIds: string[], updates: any) => {
    return processBulkOperation({
      operation: 'bulk-update',
      userIds,
      updates
    });
  };

  return {
    isProcessing,
    bulkDelete,
    bulkRoleChange,
    bulkUpdate,
    processBulkOperation
  };
}
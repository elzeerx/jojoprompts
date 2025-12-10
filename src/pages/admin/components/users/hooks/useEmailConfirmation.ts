import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { callEdgeFunction } from "@/utils/edgeFunctions";

export function useEmailConfirmation() {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const { toast } = useToast();

  const confirmUserEmail = async (userId: string, userName?: string): Promise<boolean> => {
    setProcessingUserId(userId);
    try {
      const result = await callEdgeFunction("admin-bulk-confirm-users", {
        userIds: [userId],
        dryRun: false
      });

      if (result.confirmed > 0) {
        toast({
          title: "Email Confirmed",
          description: `Successfully confirmed email for ${userName || 'user'}`,
        });
        return true;
      } else {
        throw new Error("Failed to confirm email");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Confirmation Failed",
        description: error.message || "Failed to confirm user email",
      });
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  const bulkConfirmUsers = async (
    startDate?: string,
    endDate?: string,
    onlyWithActiveSubscriptions = false,
    dryRun = true
  ): Promise<any> => {
    setBulkProcessing(true);
    try {
      const result = await callEdgeFunction("admin-bulk-confirm-users", {
        startDate,
        endDate,
        onlyWithActiveSubscriptions,
        dryRun
      });

      if (dryRun) {
        toast({
          title: "Dry Run Complete",
          description: `Would confirm ${result.totalUsers} users`,
        });
      } else {
        toast({
          title: "Bulk Confirmation Complete",
          description: `Confirmed ${result.confirmed} out of ${result.processed} users`,
        });
      }

      return result;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Bulk Confirmation Failed",
        description: error.message || "Failed to confirm users",
      });
      throw error;
    } finally {
      setBulkProcessing(false);
    }
  };

  return {
    confirmUserEmail,
    bulkConfirmUsers,
    processingUserId,
    bulkProcessing
  };
}

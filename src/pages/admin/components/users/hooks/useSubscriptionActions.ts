
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export function useSubscriptionActions() {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const { session } = useAuth();

  const cancelUserSubscription = async (userId: string, userEmail: string) => {
    if (!window.confirm(`Are you sure you want to cancel the subscription for ${userEmail}? This action cannot be undone.`)) {
      return false;
    }

    setProcessingUserId(userId);
    try {
      if (!session) {
        toast({
          title: "Authentication Error",
          description: "Admin authentication is required for subscription management.",
          variant: "destructive",
        });
        return false;
      }
      
      const { data, error } = await supabase.functions.invoke(
        "cancel-subscription",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: { 
            userId
          }
        }
      );

      if (error || (data && data.error)) {
        throw new Error(error?.message || data?.error || "Error cancelling subscription");
      }
      
      if (data && !data.success) {
        throw new Error(data.error || "Failed to cancel subscription");
      }
      
      toast({
        title: "Subscription Cancelled",
        description: `Subscription for ${userEmail} has been cancelled successfully.`,
      });

      return true;
    } catch (error: any) {
      console.error("Error cancelling subscription:", error);
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  return {
    processingUserId,
    cancelUserSubscription
  };
}

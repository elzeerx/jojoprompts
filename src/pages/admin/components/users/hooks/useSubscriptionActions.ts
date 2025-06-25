
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useSubscriptionNotificationEmails } from "@/hooks/useSubscriptionNotificationEmails";

export function useSubscriptionActions() {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const { session } = useAuth();
  const { sendSubscriptionStatusChange } = useSubscriptionNotificationEmails();

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
      
      // Send subscription cancellation notification email
      try {
        // Get user details for the email
        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', userId)
          .single();

        const userName = userProfile?.first_name 
          ? `${userProfile.first_name} ${userProfile.last_name || ''}`.trim()
          : userEmail.split('@')[0];

        // Get subscription details from the response or fetch them
        const planName = data?.planName || "Premium Plan"; // Fallback if not provided
        const effectiveDate = new Date().toISOString();

        await sendSubscriptionStatusChange(
          userName,
          userEmail,
          planName,
          'cancelled',
          effectiveDate,
          'Cancelled by administrator'
        );
      } catch (emailError) {
        console.error('Failed to send cancellation email:', emailError);
        // Don't fail the entire operation if email fails
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

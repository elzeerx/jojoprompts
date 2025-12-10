
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('PLAN_ASSIGNMENT');

export function usePlanAssignment() {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const handleAssignPlanToUser = async (userId: string, planId: string) => {
    setProcessingUserId(userId);
    
    try {
      // Get plan details
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();
      
      if (planError) throw planError;
      
      // Calculate end date for non-lifetime plans
      let endDate = null;
      if (!planData.is_lifetime && planData.duration_days) {
        const startDate = new Date();
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + planData.duration_days);
      }
      
      // Check for existing subscription and update it
      const { data: existingSub, error: checkError } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') throw checkError;
      
      let operation;
      if (existingSub) {
        // Update existing subscription
        operation = supabase
          .from('user_subscriptions')
          .update({
            plan_id: planId,
            end_date: endDate,
            payment_method: 'admin_assigned', 
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSub.id)
          .select();
      } else {
        // Create new subscription
        operation = supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            plan_id: planId,
            start_date: new Date().toISOString(),
            end_date: endDate,
            status: 'active',
            payment_method: 'admin_assigned'
          })
          .select();
      }
      
      const { error: opError } = await operation;
      if (opError) throw opError;
      
      // Add to transaction history
      await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          plan_id: planId,
          amount_usd: planData.price_usd,
          status: 'completed'
        });
      
      toast({
        title: "Plan assigned",
        description: `Successfully assigned ${planData.name} plan to the user.`
      });
      
      return true;
    } catch (error: any) {
      const appError = handleError(error, { component: 'usePlanAssignment', action: 'assignPlan' });
      logger.error('Error assigning plan', { error: appError, userId, planId });
      
      toast({
        title: "Assignment failed",
        description: error.message || "Failed to assign plan to user.",
        variant: "destructive"
      });
    } finally {
      setProcessingUserId(null);
    }
  };

  return {
    processingUserId,
    assignPlanToUser: handleAssignPlanToUser
  };
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PlanAssignmentResult {
  success: boolean;
  message?: string;
  data?: any;
}

export function usePlanAssignment() {
  const queryClient = useQueryClient();

  const assignPlanMutation = useMutation({
    mutationFn: async ({ userId, planId }: { userId: string; planId: string }): Promise<PlanAssignmentResult> => {
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

      return {
        success: true,
        message: `Successfully assigned ${planData.name} plan to the user`,
        data: { planData, endDate, isUpdate: !!existingSub }
      };
    },
    onMutate: async ({ userId, planId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });

      // Snapshot the previous value
      const previousUsers = queryClient.getQueriesData({ queryKey: ['admin-users'] });

      // Get plan name for optimistic update
      const { data: planData } = await supabase
        .from('subscription_plans')
        .select('name, price_usd, is_lifetime')
        .eq('id', planId)
        .single();

      // Optimistically update the user's subscription
      if (planData) {
        queryClient.setQueriesData({ queryKey: ['admin-users'] }, (old: any) => {
          if (!old) return old;
          
          return {
            ...old,
            users: old.users.map((user: any) => 
              user.id === userId 
                ? { 
                    ...user,
                    subscription: {
                      plan_name: planData.name,
                      status: 'active',
                      end_date: planData.is_lifetime ? null : new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString(), // 30 days from now as placeholder
                      is_lifetime: planData.is_lifetime,
                      price_usd: planData.price_usd
                    }
                  }
                : user
            )
          };
        });
      }

      return { previousUsers };
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic update
      if (context?.previousUsers) {
        context.previousUsers.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      console.error("Error assigning plan:", error);
      toast({
        title: "Assignment failed",
        description: error.message || "Failed to assign plan to user.",
        variant: "destructive"
      });
    },
    onSuccess: (result) => {
      toast({
        title: "Plan assigned",
        description: result.message
      });

      // Invalidate and refetch users query
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  return {
    assignPlanToUser: (userId: string, planId: string) => 
      assignPlanMutation.mutateAsync({ userId, planId }),
    processingUserId: assignPlanMutation.isPending ? assignPlanMutation.variables?.userId : null,
    isLoading: assignPlanMutation.isPending,
    error: assignPlanMutation.error?.message || null
  };
}
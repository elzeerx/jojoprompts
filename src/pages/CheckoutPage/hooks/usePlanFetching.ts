
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logInfo, logError, logDebug } from '@/utils/secureLogging';
import type { UsePlanFetchingParams } from '../types';

export function usePlanFetching({ planId, user, setSelectedPlan, setError, setLoading }: UsePlanFetchingParams) {
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlan = async () => {
      if (!planId) {
        logError("No plan ID provided in checkout", "checkout");
        setError("No plan selected");
        toast({
          title: "Error",
          description: "No plan selected. Redirecting to pricing page.",
          variant: "destructive",
        });
        setTimeout(() => navigate("/pricing"), 2000);
        return;
      }

      try {
        logDebug("Fetching plan details", "checkout", { planId });
        setLoading(true);
        const { data, error } = await supabase
          .from("subscription_plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (error) throw error;

        logInfo("Plan fetched successfully", "checkout", { planName: data.name }, user?.id);
        setSelectedPlan(data);
        setError(null);
      } catch (error: any) {
        logError("Error fetching plan details", "checkout", { planId, error: error.message }, user?.id);
        setError("Failed to load plan details");
        toast({
          title: "Error",
          description: "Failed to load plan details",
          variant: "destructive",
        });
        setTimeout(() => navigate("/pricing"), 2000);
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [planId, navigate, user?.id, setSelectedPlan, setError, setLoading]);
}

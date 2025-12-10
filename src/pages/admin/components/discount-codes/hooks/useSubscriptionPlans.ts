
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('SUBSCRIPTION_PLANS');

interface SubscriptionPlan {
  id: string;
  name: string;
  price_usd: number;
}

export function useSubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('id, name, price_usd')
          .order('price_usd', { ascending: true });

        if (error) throw error;
        setPlans(data || []);
      } catch (error) {
        const appError = handleError(error, { component: 'useSubscriptionPlans', action: 'fetchPlans' });
        logger.error('Error fetching subscription plans', { error: appError });
        toast({
          title: "Error",
          description: "Failed to load subscription plans",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  return { plans, loading };
}

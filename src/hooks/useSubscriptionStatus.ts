
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logInfo, logError } from '@/utils/secureLogging';

interface SubscriptionStatus {
  isActive: boolean;
  planId: string | null;
  planName: string | null;
  expiresAt: string | null;
  isLifetime: boolean;
  loading: boolean;
  error: string | null;
}

export function useSubscriptionStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>({
    isActive: false,
    planId: null,
    planName: null,
    expiresAt: null,
    isLifetime: false,
    loading: true,
    error: null
  });

  const checkSubscriptionStatus = async () => {
    if (!user?.id) {
      setStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      setStatus(prev => ({ ...prev, loading: true, error: null }));
      
      logInfo('Checking subscription status', 'subscription', undefined, user.id);

      // Get active subscription
      const { data: subscription, error: subscriptionError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          subscription_plans:plan_id (
            name,
            is_lifetime,
            duration_days
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscriptionError) {
        throw new Error(`Subscription query failed: ${subscriptionError.message}`);
      }

      if (!subscription) {
        logInfo('No active subscription found', 'subscription', undefined, user.id);
        setStatus({
          isActive: false,
          planId: null,
          planName: null,
          expiresAt: null,
          isLifetime: false,
          loading: false,
          error: null
        });
        return;
      }

      const plan = subscription.subscription_plans;
      const isLifetime = plan?.is_lifetime || false;
      
      // Calculate expiration date if not lifetime
      let expiresAt = null;
      if (!isLifetime && plan?.duration_days) {
        const createdDate = new Date(subscription.created_at);
        const expirationDate = new Date(createdDate.getTime() + (plan.duration_days * 24 * 60 * 60 * 1000));
        expiresAt = expirationDate.toISOString();
        
        // Check if subscription has expired
        const now = new Date();
        if (expirationDate < now) {
          // Mark subscription as expired
          await supabase
            .from('subscriptions')
            .update({ status: 'expired' })
            .eq('id', subscription.id);
          
          setStatus({
            isActive: false,
            planId: null,
            planName: null,
            expiresAt: null,
            isLifetime: false,
            loading: false,
            error: null
          });
          return;
        }
      }

      logInfo('Active subscription found', 'subscription', {
        planId: subscription.plan_id,
        planName: plan?.name,
        isLifetime
      }, user.id);

      setStatus({
        isActive: true,
        planId: subscription.plan_id,
        planName: plan?.name || 'Unknown Plan',
        expiresAt,
        isLifetime,
        loading: false,
        error: null
      });

    } catch (error: any) {
      logError('Failed to check subscription status', 'subscription', {
        error: error.message
      }, user?.id);
      
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  useEffect(() => {
    checkSubscriptionStatus();
  }, [user?.id]);

  return {
    ...status,
    refresh: checkSubscriptionStatus
  };
}

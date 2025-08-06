import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { safeLog } from '@/utils/safeLogging';

interface PaymentStatusData {
  id: string;
  amount_usd: number;
  status: string;
  created_at: string;
  completed_at?: string;
  paypal_order_id?: string;
  paypal_payment_id?: string;
  error_message?: string;
  plan_id: string;
  is_upgrade: boolean;
  subscription_plans?: {
    name: string;
    price_usd: number;
  };
}

interface UserSubscription {
  id: string;
  status: string;
  start_date: string;
  end_date?: string;
  plan_id: string;
  payment_method: string;
  subscription_plans?: {
    id: string;
    name: string;
    price_usd: number;
    is_lifetime: boolean;
  };
}

export function usePaymentStatus() {
  const [transactions, setTransactions] = useState<PaymentStatusData[]>([]);
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchPaymentStatus = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch user transactions
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .select(`
          id,
          amount_usd,
          status,
          created_at,
          completed_at,
          paypal_order_id,
          paypal_payment_id,
          error_message,
          plan_id,
          is_upgrade
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (transactionError) {
        throw new Error(`Failed to fetch transactions: ${transactionError.message}`);
      }

      // Fetch plan details separately to avoid join issues
      const planIds = transactionData?.map(t => t.plan_id).filter((id, index, self) => self.indexOf(id) === index) || [];
      const { data: planData } = await supabase
        .from('subscription_plans')
        .select('id, name, price_usd, is_lifetime')
        .in('id', planIds);

      // Enrich transactions with plan data
      const enrichedTransactions = transactionData?.map(transaction => ({
        ...transaction,
        subscription_plans: planData?.find(plan => plan.id === transaction.plan_id)
      })) || [];

      // Fetch user subscriptions
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select(`
          id,
          status,
          start_date,
          end_date,
          plan_id,
          payment_method
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (subscriptionError) {
        throw new Error(`Failed to fetch subscriptions: ${subscriptionError.message}`);
      }

      // Enrich subscriptions with plan data
      const enrichedSubscriptions = subscriptionData?.map(subscription => ({
        ...subscription,
        subscription_plans: planData?.find(plan => plan.id === subscription.plan_id)
      })) || [];

      setTransactions(enrichedTransactions);
      setSubscriptions(enrichedSubscriptions);
      safeLog.debug('Payment status fetched successfully', {
        transactions: enrichedTransactions?.length,
        subscriptions: enrichedSubscriptions?.length
      });

    } catch (err: any) {
      safeLog.error('Failed to fetch payment status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const retryFailedPayment = async (transactionId: string, planId: string): Promise<{ success: boolean; error?: string; redirectUrl?: string }> => {
    try {
      safeLog.debug('Retrying failed payment', { transactionId, planId });

      // Get plan details for retry
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('price_usd')
        .eq('id', planId)
        .single();

      if (planError || !planData) {
        throw new Error('Could not find plan details for retry');
      }

      // Create new PayPal order for retry
      const { data, error } = await supabase.functions.invoke('process-paypal-payment', {
        body: {
          action: 'create',
          amount: planData.price_usd,
          planId,
          userId: user?.id,
          retryTransactionId: transactionId
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to create retry payment');
      }

      return {
        success: true,
        redirectUrl: data.approvalUrl
      };

    } catch (err: any) {
      safeLog.error('Payment retry failed:', err);
      return {
        success: false,
        error: err.message
      };
    }
  };

  const cancelSubscription = async (subscriptionId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      safeLog.debug('Cancelling subscription', { subscriptionId });

      const { data, error } = await supabase
        .from('user_subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', subscriptionId)
        .eq('user_id', user?.id);

      if (error) {
        throw new Error(`Failed to cancel subscription: ${error.message}`);
      }

      // Refresh data after cancellation
      await fetchPaymentStatus();

      return { success: true };

    } catch (err: any) {
      safeLog.error('Subscription cancellation failed:', err);
      return {
        success: false,
        error: err.message
      };
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchPaymentStatus();
    }
  }, [user?.id]);

  return {
    transactions,
    subscriptions,
    loading,
    error,
    refetch: fetchPaymentStatus,
    retryFailedPayment,
    cancelSubscription
  };
}
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SessionManager } from './helpers/sessionManager';
import { safeLog } from '@/utils/safeLogging';

interface PaymentRecoveryParams {
  orderId?: string;
  paymentId?: string;
  planId?: string;
  userId?: string;
}

interface PaymentRecoveryResult {
  canRecover: boolean;
  userEmail?: string;
  planName?: string;
  amount?: number;
  transactionId?: string;
  subscriptionActive?: boolean;
  needsLogin?: boolean;
  recoveryData?: any;
}

/**
 * Hook to handle payment recovery for users who completed payments but lost their session
 */
export function usePaymentRecovery(params: PaymentRecoveryParams) {
  const [loading, setLoading] = useState(true);
  const [recoveryResult, setRecoveryResult] = useState<PaymentRecoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const attemptPaymentRecovery = async () => {
      if (!params.orderId && !params.paymentId && !params.userId) {
        setLoading(false);
        return;
      }

      try {
        safeLog.debug('Attempting payment recovery with params:', params);

        // Try to find completed transaction
        let transactionQuery = supabase
          .from('transactions')
          .select(`
            id,
            user_id,
            plan_id,
            amount_usd,
            status,
            paypal_order_id,
            paypal_payment_id,
            completed_at
          `)
          .eq('status', 'completed');

        // Build query based on available parameters
        if (params.orderId) {
          transactionQuery = transactionQuery.eq('paypal_order_id', params.orderId);
        } else if (params.paymentId) {
          transactionQuery = transactionQuery.eq('paypal_payment_id', params.paymentId);
        } else if (params.userId && params.planId) {
          transactionQuery = transactionQuery
            .eq('user_id', params.userId)
            .eq('plan_id', params.planId);
        }

        const { data: transaction, error: transactionError } = await transactionQuery
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (transactionError) {
          throw new Error(`Failed to find transaction: ${transactionError.message}`);
        }

        if (!transaction) {
          safeLog.debug('No completed transaction found for recovery');
          setRecoveryResult({
            canRecover: false,
            needsLogin: true
          });
          setLoading(false);
          return;
        }

        safeLog.debug('Found completed transaction for recovery:', transaction);

        // Get plan details
        const { data: planData, error: planError } = await supabase
          .from('subscription_plans')
          .select('name, price_usd')
          .eq('id', transaction.plan_id)
          .single();

        if (planError) {
          safeLog.warn('Could not retrieve plan details:', planError);
        }

        // Check if user has active subscription
        const { data: subscription, error: subscriptionError } = await supabase
          .from('user_subscriptions')
          .select('id, status, created_at')
          .eq('user_id', transaction.user_id)
          .eq('plan_id', transaction.plan_id)
          .eq('status', 'active')
          .maybeSingle();

        if (subscriptionError) {
          safeLog.error('Error checking subscription:', subscriptionError);
        }

        // Get user email for recovery
        let userEmail: string | undefined;
        try {
          const { data: { user: authUser } } = await supabase.auth.admin.getUserById(transaction.user_id);
          userEmail = authUser?.email;
        } catch (emailError) {
          safeLog.warn('Could not retrieve user email for recovery:', emailError);
        }

        const recoveryData = {
          canRecover: true,
          userEmail,
          planName: planData?.name,
          amount: transaction.amount_usd,
          transactionId: transaction.id,
          subscriptionActive: !!subscription,
          needsLogin: !userEmail, // If we can't get email, user probably needs to login
          recoveryData: {
            userId: transaction.user_id,
            planId: transaction.plan_id,
            transactionId: transaction.id,
            paymentId: transaction.paypal_payment_id,
            orderId: transaction.paypal_order_id
          }
        };

        safeLog.debug('Payment recovery successful:', recoveryData);
        setRecoveryResult(recoveryData);

      } catch (err: any) {
        safeLog.error('Payment recovery failed:', err);
        setError(err.message);
        setRecoveryResult({
          canRecover: false,
          needsLogin: true
        });
      } finally {
        setLoading(false);
      }
    };

    attemptPaymentRecovery();
  }, [params.orderId, params.paymentId, params.planId, params.userId]);

  const attemptAutoLogin = async (userEmail: string): Promise<boolean> => {
    try {
      safeLog.debug('Attempting auto-login for payment recovery:', userEmail);

      // Try session restoration first
      if (SessionManager.hasAnyRecoveryData()) {
        const sessionResult = await SessionManager.restoreSession();
        if (sessionResult.success && sessionResult.user) {
          safeLog.debug('Auto-login successful via session restoration');
          return true;
        }
      }

      // If session restoration fails, user needs manual login
      safeLog.debug('Auto-login failed, manual login required');
      return false;

    } catch (error: any) {
      safeLog.error('Auto-login attempt failed:', error);
      return false;
    }
  };

  return {
    loading,
    recoveryResult,
    error,
    attemptAutoLogin
  };
}
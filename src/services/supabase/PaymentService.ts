/**
 * Payment service for handling subscription and transaction operations
 * Extends BaseService with payment-specific functionality
 */

import { BaseService } from './BaseService';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { ApiResponse } from '@/types/common';

// Payment-related type interfaces
export interface PaymentData {
  userId: string;
  planId: string;
  amount: number;
  currency?: string;
  paymentMethod: 'paypal' | 'stripe' | 'manual';
  paymentId?: string;
  transactionId?: string;
  discountCode?: string;
}

export interface PaymentVerificationParams {
  orderId?: string;
  paymentId?: string;
  planId: string;
  userId: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'expired';
  start_date: string;
  end_date?: string;
  payment_method: string;
  payment_id?: string;
  transaction_id?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price_usd: number;
  billing_period: 'monthly' | 'yearly' | 'lifetime';
  features: string[];
  is_active: boolean;
  is_lifetime: boolean;
}

export class PaymentService extends BaseService {
  constructor() {
    super('transactions', 'PaymentService');
  }

  // Transaction management
  async createTransaction(data: PaymentData): Promise<ApiResponse<any>> {
    const transactionData = {
      user_id: data.userId,
      plan_id: data.planId,
      amount: data.amount,
      currency: data.currency || 'USD',
      payment_method: data.paymentMethod,
      payment_id: data.paymentId,
      status: 'pending'
    };

    return this.create(transactionData);
  }

  async updateTransactionStatus(
    transactionId: string, 
    status: string, 
    metadata?: Record<string, any>
  ): Promise<ApiResponse<any>> {
    const updateData: any = { 
      status,
      updated_at: new Date().toISOString()
    };
    
    if (metadata) {
      updateData.metadata = metadata;
    }

    return this.update(transactionId, updateData);
  }

  async getTransactionsByUser(userId: string, limit = 10): Promise<ApiResponse<any[]>> {
    return this.findAll({
      filters: { user_id: userId },
      orderBy: { column: 'created_at', ascending: false },
      limit
    });
  }

  // Subscription management
  async createSubscription(data: PaymentData): Promise<ApiResponse<UserSubscription>> {
    return this.executeQuery(
      'createSubscription',
      () => supabase
        .from('user_subscriptions')
        .insert({
          user_id: data.userId,
          plan_id: data.planId,
          payment_method: data.paymentMethod,
          payment_id: data.paymentId,
          transaction_id: data.transactionId,
          status: 'active',
          start_date: new Date().toISOString()
        })
        .select('*')
        .single(),
      data
    );
  }

  async getUserSubscription(userId: string): Promise<ApiResponse<UserSubscription>> {
    return this.executeQuery(
      'getUserSubscription',
      () => supabase
        .from('user_subscriptions')
        .select('id, user_id, plan_id, status, start_date, end_date, payment_method, payment_id, created_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle(),
      { userId }
    );
  }

  async cancelSubscription(
    userId: string, 
    adminId?: string
  ): Promise<ApiResponse<UserSubscription>> {
    return this.executeQuery(
      'cancelSubscription',
      async () => {
        if (adminId) {
          // Admin cancellation
          const { data, error } = await supabase.rpc('cancel_user_subscription', {
            _user_id: userId,
            _admin_id: adminId
          });
          
          if (error) throw error;
          const result = data as any;
          if (!result.success) throw new Error(result.error);
          
          logger.security('Admin cancelled user subscription', { userId, adminId });
          
          return { data };
        } else {
          // User self-cancellation
          return supabase
            .from('user_subscriptions')
            .update({ status: 'cancelled' })
            .eq('user_id', userId)
            .eq('status', 'active')
            .select('*');
        }
      },
      { userId, adminId }
    );
  }

  // Subscription plan methods
  async getSubscriptionPlans(): Promise<ApiResponse<SubscriptionPlan[]>> {
    return this.executeQuery(
      'getSubscriptionPlans',
      () => supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_usd', { ascending: true }),
      {}
    );
  }

  async getSubscriptionPlan(planId: string): Promise<ApiResponse<SubscriptionPlan>> {
    return this.executeQuery(
      'getSubscriptionPlan',
      () => supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single(),
      { planId }
    );
  }

  // Discount code methods
  async validateDiscountCode(code: string, planId?: string, userId?: string): Promise<ApiResponse<any>> {
    return this.executeQuery(
      'validateDiscountCode',
      () => supabase.rpc('validate_discount_code', {
        code_text: code,
        plan_id_param: planId,
        user_id_param: userId
      }),
      { code, planId, userId }
    );
  }

  async recordDiscountUsage(
    discountCodeId: string, 
    userId: string, 
    paymentHistoryId?: string
  ): Promise<ApiResponse<boolean>> {
    return this.executeQuery(
      'recordDiscountUsage',
      () => supabase.rpc('record_discount_usage', {
        discount_code_id_param: discountCodeId,
        user_id_param: userId,
        payment_history_id_param: paymentHistoryId
      }),
      { discountCodeId, userId, paymentHistoryId }
    );
  }

  // PayPal integration methods
  async createPayPalPayment(data: PaymentData): Promise<ApiResponse<any>> {
    return this.callEdgeFunction('create-paypal-payment', {
      planId: data.planId,
      userId: data.userId,
      discountCode: data.discountCode
    });
  }

  async capturePayPalPayment(data: {
    orderId: string;
    planId: string;
    userId: string;
    discountCode?: string;
  }): Promise<ApiResponse<any>> {
    return this.callEdgeFunction('capture-paypal-payment', data);
  }

  async processDirectActivation(data: PaymentData): Promise<ApiResponse<any>> {
    return this.callEdgeFunction('process-direct-activation', {
      planId: data.planId,
      userId: data.userId,
      paymentMethod: data.paymentMethod
    });
  }

  async verifyPayment(params: PaymentVerificationParams): Promise<ApiResponse<any>> {
    return this.callEdgeFunction('verify-payment', params);
  }

  // Analytics and reporting
  async getPaymentStats(startDate?: string, endDate?: string): Promise<ApiResponse<any>> {
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, created_at, status')
      .gte('created_at', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .lte('created_at', endDate || new Date().toISOString());

    const { data: subscriptions } = await supabase
      .from('user_subscriptions')
      .select('created_at, status')
      .gte('created_at', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .lte('created_at', endDate || new Date().toISOString());

    const totalRevenue = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
    const successfulTransactions = transactions?.filter(t => t.status === 'completed').length || 0;
    const newSubscriptions = subscriptions?.filter(s => s.status === 'active').length || 0;

    return {
      success: true,
      data: {
        totalRevenue,
        successfulTransactions,
        newSubscriptions,
        totalTransactions: transactions?.length || 0,
        conversionRate: transactions?.length ? (successfulTransactions / transactions.length) * 100 : 0
      }
    };
  }

  async getSubscriptionStats(): Promise<ApiResponse<any>> {
    const { data: subscriptionCounts } = await supabase
      .from('user_subscriptions')
      .select('status');

    const activeSubscriptions = subscriptionCounts?.filter(s => s.status === 'active').length || 0;
    const cancelledSubscriptions = subscriptionCounts?.filter(s => s.status === 'cancelled').length || 0;
    const expiredSubscriptions = subscriptionCounts?.filter(s => s.status === 'expired').length || 0;

    return {
      success: true,
      data: {
        active: activeSubscriptions,
        cancelled: cancelledSubscriptions,
        expired: expiredSubscriptions,
        total: subscriptionCounts?.length || 0,
        churnRate: subscriptionCounts?.length ? (cancelledSubscriptions / subscriptionCounts.length) * 100 : 0
      }
    };
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
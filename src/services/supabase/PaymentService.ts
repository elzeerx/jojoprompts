/**
 * Payment service for handling subscription and transaction operations
 * Simplified to avoid TypeScript type recursion issues
 */

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

export class PaymentService {
  constructor() {}

  // Transaction management
  async createTransaction(data: PaymentData): Promise<ApiResponse<any>> {
    try {
      const transactionData = {
        user_id: data.userId,
        plan_id: data.planId,
        amount_usd: data.amount,
        payment_method: data.paymentMethod,
        paypal_payment_id: data.paymentId,
        status: 'pending'
      };

      const { data: result, error } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select('*')
        .single();

      if (error) throw error;

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  async updateTransactionStatus(
    transactionId: string, 
    status: string, 
    metadata?: Record<string, any>
  ): Promise<ApiResponse<any>> {
    try {
      const updateData: any = { 
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null
      };
      
      if (metadata) {
        updateData.error_message = metadata.error;
      }

      const { data, error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transactionId)
        .select('*')
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  async getTransactionsByUser(userId: string, limit = 10): Promise<ApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  // Subscription management
  async createSubscription(data: PaymentData): Promise<ApiResponse<any>> {
    try {
      const { data: result, error } = await supabase
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
        .single();

      if (error) throw error;

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  async getUserSubscription(userId: string): Promise<ApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  async cancelSubscription(userId: string, adminId?: string): Promise<ApiResponse<any>> {
    try {
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
        
        return { success: true, data: result };
      } else {
        // User self-cancellation
        const { data, error } = await supabase
          .from('user_subscriptions')
          .update({ status: 'cancelled' })
          .eq('user_id', userId)
          .eq('status', 'active')
          .select('*');

        if (error) throw error;

        return { success: true, data };
      }
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  // Subscription plan methods
  async getSubscriptionPlans(): Promise<ApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price_usd', { ascending: true });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  async getSubscriptionPlan(planId: string): Promise<ApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  // Discount code methods
  async validateDiscountCode(code: string, planId?: string, userId?: string): Promise<ApiResponse<any>> {
    try {
      const { data, error } = await supabase.rpc('validate_discount_code', {
        code_text: code,
        plan_id_param: planId,
        user_id_param: userId
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  async recordDiscountUsage(
    discountCodeId: string, 
    userId: string, 
    paymentHistoryId?: string
  ): Promise<ApiResponse<boolean>> {
    try {
      const { data, error } = await supabase.rpc('record_discount_usage', {
        discount_code_id_param: discountCodeId,
        user_id_param: userId,
        payment_history_id_param: paymentHistoryId
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  // PayPal integration methods
  async createPayPalPayment(data: PaymentData): Promise<ApiResponse<any>> {
    try {
      const { data: result, error } = await supabase.functions.invoke('create-paypal-payment', {
        body: {
          planId: data.planId,
          userId: data.userId,
          discountCode: data.discountCode
        }
      });

      if (error) throw error;

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  async capturePayPalPayment(data: {
    orderId: string;
    planId: string;
    userId: string;
    discountCode?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const { data: result, error } = await supabase.functions.invoke('capture-paypal-payment', {
        body: data
      });

      if (error) throw error;

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  async verifyPayment(params: PaymentVerificationParams): Promise<ApiResponse<any>> {
    try {
      const { data: result, error } = await supabase.functions.invoke('verify-payment', {
        body: params
      });

      if (error) throw error;

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  // Analytics and reporting
  async getPaymentStats(startDate?: string, endDate?: string): Promise<ApiResponse<any>> {
    try {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount_usd, created_at, status')
        .gte('created_at', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', endDate || new Date().toISOString());

      const { data: subscriptions } = await supabase
        .from('user_subscriptions')
        .select('created_at, status')
        .gte('created_at', startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', endDate || new Date().toISOString());

      const totalRevenue = transactions?.reduce((sum, t) => sum + (t.amount_usd || 0), 0) || 0;
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
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
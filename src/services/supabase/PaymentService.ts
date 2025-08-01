/**
 * Payment service for handling subscriptions, transactions, and payments
 */

import { BaseService } from './BaseService';
import { 
  Transaction, 
  UserSubscription, 
  SubscriptionPlan, 
  DiscountCode,
  DiscountValidation,
  ApiResponse,
  TransactionStatus,
  SubscriptionStatus
} from '@/types/common';
import { logger } from '@/utils/logger';

export interface PaymentData {
  planId: string;
  userId: string;
  amount: number;
  appliedDiscount?: DiscountCode;
}

export interface PaymentVerificationParams {
  orderId?: string;
  paymentId?: string;
  planId?: string;
  userId?: string;
}

class PaymentService extends BaseService {
  constructor() {
    super('transactions', 'PaymentService');
  }

  // Transaction methods
  async createTransaction(data: {
    userId: string;
    planId: string;
    amount: number;
    paypalOrderId?: string;
    isUpgrade?: boolean;
    upgradeFromPlanId?: string;
  }): Promise<ApiResponse<Transaction>> {
    return this.executeQuery(
      'createTransaction',
      () => this.create({
        user_id: data.userId,
        plan_id: data.planId,
        amount_usd: data.amount,
        paypal_order_id: data.paypalOrderId,
        is_upgrade: data.isUpgrade || false,
        upgrade_from_plan_id: data.upgradeFromPlanId,
        status: 'pending'
      }),
      data
    );
  }

  async updateTransactionStatus(
    transactionId: string, 
    status: TransactionStatus,
    paypalPaymentId?: string,
    errorMessage?: string
  ): Promise<ApiResponse<Transaction>> {
    const updateData: any = { 
      status,
      ...(status === 'completed' && { completed_at: new Date().toISOString() }),
      ...(paypalPaymentId && { paypal_payment_id: paypalPaymentId }),
      ...(errorMessage && { error_message: errorMessage })
    };

    return this.update(transactionId, updateData);
  }

  async getTransactionsByUser(
    userId: string, 
    limit: number = 20
  ): Promise<ApiResponse<Transaction[]>> {
    return this.findAll({
      filters: { user_id: userId },
      orderBy: { column: 'created_at', ascending: false },
      limit
    });
  }

  async getTransactionByPayPalOrder(paypalOrderId: string): Promise<ApiResponse<Transaction>> {
    return this.findOne({ paypal_order_id: paypalOrderId });
  }

  // Subscription methods
  async createSubscription(data: {
    userId: string;
    planId: string;
    paymentMethod: string;
    paymentId?: string;
    transactionId?: string;
  }): Promise<ApiResponse<UserSubscription>> {
    return this.executeQuery(
      'createSubscription',
      () => {
        const subscriptionService = new BaseService<UserSubscription>('user_subscriptions');
        return subscriptionService.create({
          user_id: data.userId,
          plan_id: data.planId,
          payment_method: data.paymentMethod,
          payment_id: data.paymentId,
          transaction_id: data.transactionId,
          status: 'active',
          start_date: new Date().toISOString()
        });
      },
      data
    );
  }

  async getUserSubscription(userId: string): Promise<ApiResponse<UserSubscription>> {
    return this.executeQuery(
      'getUserSubscription',
      () => {
        const subscriptionService = new BaseService<UserSubscription>('user_subscriptions');
        return subscriptionService.findOne(
          { 
            user_id: userId, 
            status: 'active' 
          },
          `*, subscription_plans(*)`
        );
      },
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
          const { data, error } = await this.callFunction('cancel_user_subscription', {
            _user_id: userId,
            _admin_id: adminId
          });
          
          if (error) throw error;
          if (!data.success) throw new Error(data.error);
          
          logger.security('Admin cancelled user subscription', this.serviceName, {
            userId,
            adminId
          });
          
          return { data };
        } else {
          // User self-cancellation
          const subscriptionService = new BaseService<UserSubscription>('user_subscriptions');
          return subscriptionService.updateMany(
            { user_id: userId, status: 'active' },
            { status: 'cancelled' }
          );
        }
      },
      { userId, adminId }
    );
  }

  // Subscription plan methods
  async getSubscriptionPlans(): Promise<ApiResponse<SubscriptionPlan[]>> {
    return this.executeQuery(
      'getSubscriptionPlans',
      () => {
        const planService = new BaseService<SubscriptionPlan>('subscription_plans');
        return planService.findAll({
          orderBy: { column: 'price_usd', ascending: true }
        });
      }
    );
  }

  async getSubscriptionPlan(planId: string): Promise<ApiResponse<SubscriptionPlan>> {
    return this.executeQuery(
      'getSubscriptionPlan',
      () => {
        const planService = new BaseService<SubscriptionPlan>('subscription_plans');
        return planService.findById(planId);
      },
      { planId }
    );
  }

  // Discount code methods
  async validateDiscountCode(
    code: string,
    planId?: string,
    userId?: string
  ): Promise<ApiResponse<DiscountValidation>> {
    return this.callFunction('validate_discount_code', {
      code_text: code.toUpperCase(),
      plan_id_param: planId,
      user_id_param: userId
    });
  }

  async recordDiscountUsage(
    discountCodeId: string,
    userId?: string,
    paymentHistoryId?: string
  ): Promise<ApiResponse<boolean>> {
    return this.callFunction('record_discount_usage', {
      discount_code_id_param: discountCodeId,
      user_id_param: userId,
      payment_history_id_param: paymentHistoryId
    });
  }

  // PayPal integration methods
  async createPayPalPayment(data: PaymentData): Promise<ApiResponse<{
    orderId: string;
    approvalUrl: string;
  }>> {
    return this.callEdgeFunction('process-paypal-payment', {
      action: 'create',
      planId: data.planId,
      userId: data.userId,
      amount: data.amount,
      appliedDiscount: data.appliedDiscount
    });
  }

  async capturePayPalPayment(data: {
    orderId: string;
    planId: string;
    userId: string;
  }): Promise<ApiResponse<any>> {
    return this.callEdgeFunction('process-paypal-payment', {
      action: 'capture',
      orderId: data.orderId,
      planId: data.planId,
      userId: data.userId
    });
  }

  async processDirectActivation(data: PaymentData): Promise<ApiResponse<{
    transactionId: string;
    subscriptionId: string;
    paymentId: string;
  }>> {
    return this.callEdgeFunction('process-paypal-payment', {
      action: 'direct-activation',
      planId: data.planId,
      userId: data.userId,
      amount: data.amount,
      appliedDiscount: data.appliedDiscount
    });
  }

  async verifyPayment(params: PaymentVerificationParams): Promise<ApiResponse<any>> {
    return this.callEdgeFunction('verify-paypal-payment', params);
  }

  // Analytics and reporting
  async getPaymentStats(
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<Record<string, any>>> {
    return this.executeQuery(
      'getPaymentStats',
      async () => {
        const baseQuery = this.tableName === 'transactions' 
          ? supabase.from('transactions') 
          : supabase.from('transactions');

        let query = baseQuery.select('*');
        
        if (startDate) {
          query = query.gte('created_at', startDate);
        }
        
        if (endDate) {
          query = query.lte('created_at', endDate);
        }

        const { data: transactions, error } = await query;
        
        if (error) throw error;

        const stats = {
          totalTransactions: transactions?.length || 0,
          totalRevenue: transactions?.reduce((sum, t) => sum + (t.amount_usd || 0), 0) || 0,
          completedTransactions: transactions?.filter(t => t.status === 'completed').length || 0,
          failedTransactions: transactions?.filter(t => t.status === 'failed').length || 0,
          averageTransactionValue: 0
        };

        if (stats.totalTransactions > 0) {
          stats.averageTransactionValue = stats.totalRevenue / stats.totalTransactions;
        }

        return { data: stats };
      },
      { startDate, endDate }
    );
  }

  async getSubscriptionStats(): Promise<ApiResponse<Record<string, any>>> {
    return this.executeQuery(
      'getSubscriptionStats',
      async () => {
        const { data: subscriptions, error } = await supabase
          .from('user_subscriptions')
          .select('*, subscription_plans(*)');

        if (error) throw error;

        const stats = {
          totalSubscriptions: subscriptions?.length || 0,
          activeSubscriptions: subscriptions?.filter(s => s.status === 'active').length || 0,
          cancelledSubscriptions: subscriptions?.filter(s => s.status === 'cancelled').length || 0,
          planBreakdown: {} as Record<string, number>
        };

        // Plan breakdown
        subscriptions?.forEach(sub => {
          const planName = sub.subscription_plans?.name || 'Unknown';
          stats.planBreakdown[planName] = (stats.planBreakdown[planName] || 0) + 1;
        });

        return { data: stats };
      }
    );
  }
}

export const paymentService = new PaymentService();
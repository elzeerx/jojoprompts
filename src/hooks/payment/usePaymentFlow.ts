/**
 * Payment state management hook - refactored from usePaymentProcessing
 * Handles payment flow state with proper separation of concerns
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { paymentService } from '@/services/supabase';
import { PaymentContextData, PaymentVerificationResult } from '@/types/common';

export interface PaymentState {
  status: string;
  error: string | null;
  pollCount: number;
  paymentId: string | null;
  restoredFromBackup: boolean;
}

export interface PaymentFlowOptions {
  maxPolls?: number;
  pollInterval?: number;
  autoNavigate?: boolean;
}

export function usePaymentFlow(options: PaymentFlowOptions = {}) {
  const navigate = useNavigate();
  
  const {
    maxPolls = 30,
    pollInterval = 2000,
    autoNavigate = true
  } = options;

  const [state, setState] = useState<PaymentState>({
    status: 'checking',
    error: null,
    pollCount: 0,
    paymentId: null,
    restoredFromBackup: false
  });

  const updateState = useCallback((updates: Partial<PaymentState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Payment verification action
  const verifyPayment = useAsyncAction(
    async (params: any): Promise<PaymentVerificationResult> => {
      const result = await paymentService.verifyPayment(params);
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Payment verification failed');
      }

      return result.data;
    },
    {
      context: 'PaymentVerification',
      onSuccess: (result: PaymentVerificationResult) => {
        logger.payment('Payment verification successful', { 
          status: result.status,
          transactionId: result.transactionId 
        });
        
        updateState({
          status: result.status,
          paymentId: result.transactionId || null
        });

        if (autoNavigate) {
          handlePaymentComplete(result);
        }
      },
      onError: (error: string) => {
        logger.error('Payment verification failed', 'PaymentFlow', { error });
        updateState({ error, status: 'FAILED' });
        
        if (autoNavigate) {
          navigateToFailure(error);
        }
      }
    }
  );

  // Session recovery
  const restorePaymentSession = useCallback(async () => {
    try {
      const backupData = localStorage.getItem('paymentContext');
      if (!backupData) return null;

      const context: PaymentContextData = JSON.parse(backupData);
      
      logger.payment('Restoring payment session from backup', context);
      
      updateState({ restoredFromBackup: true });
      return context;
    } catch (error) {
      logger.error('Failed to restore payment session', 'PaymentFlow', { error });
      return null;
    }
  }, []);

  // Navigation helpers
  const handlePaymentComplete = useCallback((result: PaymentVerificationResult) => {
    if (result.success && result.status === 'COMPLETED') {
      const params = new URLSearchParams();
      
      if (result.transactionId) params.append('transactionId', result.transactionId);
      if (result.subscriptionId) params.append('subscriptionId', result.subscriptionId);
      
      navigate(`/payment-success?${params.toString()}`);
    } else {
      navigateToFailure(result.error || 'Payment not completed');
    }
  }, [navigate]);

  const navigateToFailure = useCallback((reason: string) => {
    const params = new URLSearchParams();
    params.append('reason', reason);
    navigate(`/payment-failed?${params.toString()}`);
  }, [navigate]);

  // Polling mechanism
  const startPolling = useCallback(async (verificationParams: any) => {
    let currentPollCount = 0;
    
    const poll = async (): Promise<void> => {
      if (currentPollCount >= maxPolls) {
        updateState({ 
          error: 'Payment verification timeout',
          status: 'TIMEOUT' 
        });
        
        if (autoNavigate) {
          navigateToFailure('Payment verification timeout');
        }
        return;
      }

      updateState({ pollCount: currentPollCount });
      
      try {
        await verifyPayment.execute(verificationParams);
        
        // If verification is still in progress, schedule next poll
        if (['checking', 'APPROVED', 'pending'].includes(state.status)) {
          currentPollCount++;
          setTimeout(poll, pollInterval);
        }
      } catch (error) {
        // Error handling is done in the verifyPayment onError callback
      }
    };

    await poll();
  }, [maxPolls, pollInterval, autoNavigate, verifyPayment, state.status, updateState, navigateToFailure]);

  // Main payment processing function
  const processPayment = useCallback(async (params: {
    success?: boolean;
    paymentId?: string;
    orderId?: string;
    planId?: string;
    userId?: string;
  }) => {
    logger.payment('Starting payment processing', params);
    
    // Reset state
    updateState({
      status: 'checking',
      error: null,
      pollCount: 0,
      paymentId: null
    });

    // Handle payment cancellation
    if (params.success === false) {
      updateState({ status: 'CANCELLED' });
      if (autoNavigate) {
        navigateToFailure('Payment was cancelled');
      }
      return;
    }

    // Try to restore session if needed
    if (!params.planId || !params.userId) {
      const restoredContext = await restorePaymentSession();
      if (restoredContext) {
        params = {
          ...params,
          planId: params.planId || restoredContext.planId,
          userId: params.userId || restoredContext.userId
        };
      }
    }

    // Validate required parameters
    if (!params.planId || !params.userId) {
      const error = 'Missing required payment parameters';
      updateState({ error, status: 'FAILED' });
      if (autoNavigate) {
        navigateToFailure(error);
      }
      return;
    }

    // Start verification polling
    await startPolling({
      orderId: params.orderId,
      paymentId: params.paymentId,
      planId: params.planId,
      userId: params.userId
    });
  }, [updateState, autoNavigate, restorePaymentSession, navigateToFailure, startPolling]);

  // Clear payment context
  const clearPaymentContext = useCallback(() => {
    localStorage.removeItem('paymentContext');
    updateState({
      status: 'checking',
      error: null,
      pollCount: 0,
      paymentId: null,
      restoredFromBackup: false
    });
  }, [updateState]);

  return {
    // State
    ...state,
    isLoading: verifyPayment.loading,
    maxPolls,
    
    // Actions
    processPayment,
    restorePaymentSession,
    clearPaymentContext,
    
    // Navigation
    handlePaymentComplete,
    navigateToFailure
  };
}
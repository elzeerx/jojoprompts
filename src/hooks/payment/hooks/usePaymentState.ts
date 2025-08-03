import { useState, useRef, useCallback } from 'react';
import { PROCESSING_STATES } from '../constants/paymentProcessingConstants';
import { safeLog } from '@/utils/safeLogging';

export function usePaymentState() {
  const [status, setStatus] = useState<string>(PROCESSING_STATES.CHECKING);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [finalPaymentId, setFinalPaymentId] = useState<string | undefined>();
  const [isProcessingComplete, setIsProcessingComplete] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [restoredFromBackup, setRestoredFromBackup] = useState(false);
  
  const completeRef = useRef(false);
  const verificationAttempted = useRef(false);

  const resetState = useCallback(() => {
    setStatus(PROCESSING_STATES.CHECKING);
    setError(null);
    setPollCount(0);
    setFinalPaymentId(undefined);
    setIsProcessingComplete(false);
    verificationAttempted.current = false;
    completeRef.current = false;
  }, []);

  const setPaymentSuccess = useCallback((paymentId?: string) => {
    safeLog.debug('Setting payment success state', { paymentId });
    setStatus(PROCESSING_STATES.COMPLETED);
    setFinalPaymentId(paymentId);
    setIsProcessingComplete(true);
    completeRef.current = true;
  }, []);

  const setPaymentError = useCallback((errorMessage: string) => {
    safeLog.debug('Setting payment error state', { errorMessage });
    setError(errorMessage);
    setStatus(PROCESSING_STATES.ERROR);
  }, []);

  const setPaymentProcessing = useCallback(() => {
    safeLog.debug('Setting payment processing state');
    setStatus(PROCESSING_STATES.VERIFYING);
    setPollCount(prev => prev + 1);
  }, []);

  const setUserContext = useCallback((user: any, restored: boolean = false) => {
    setCurrentUser(user);
    setRestoredFromBackup(restored);
    setIsLoadingAuth(false);
  }, []);

  const markVerificationAttempted = useCallback(() => {
    verificationAttempted.current = true;
  }, []);

  const resetVerificationAttempted = useCallback(() => {
    verificationAttempted.current = false;
  }, []);

  const isVerificationAttempted = useCallback(() => {
    return verificationAttempted.current;
  }, []);

  const isComplete = useCallback(() => {
    return completeRef.current;
  }, []);

  return {
    // State
    status,
    error,
    pollCount,
    finalPaymentId,
    isProcessingComplete,
    currentUser,
    isLoadingAuth,
    restoredFromBackup,
    
    // Setters
    setStatus,
    setError,
    setPollCount,
    setFinalPaymentId,
    setIsProcessingComplete,
    setCurrentUser,
    setIsLoadingAuth,
    setRestoredFromBackup,
    
    // Actions
    resetState,
    setPaymentSuccess,
    setPaymentError,
    setPaymentProcessing,
    setUserContext,
    markVerificationAttempted,
    resetVerificationAttempted,
    isVerificationAttempted,
    isComplete
  };
} 
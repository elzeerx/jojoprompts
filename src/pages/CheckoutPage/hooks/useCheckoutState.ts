
import { useState } from 'react';
import type { SelectedPlan, AppliedDiscount, CheckoutState } from '../types';

export function useCheckoutState(): CheckoutState {
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);


  return {
    selectedPlan,
    setSelectedPlan,
    loading,
    setLoading,
    processing,
    setProcessing,
    error,
    setError,
    showAuthForm,
    setShowAuthForm,
    appliedDiscount,
    setAppliedDiscount
  };
}

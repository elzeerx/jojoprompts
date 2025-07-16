
import { useState } from 'react';

interface AppliedDiscount {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
}

export function useCheckoutState() {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
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

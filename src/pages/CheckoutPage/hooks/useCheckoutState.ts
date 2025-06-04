
import { useState } from 'react';

export function useCheckoutState() {
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);

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
    setShowAuthForm
  };
}

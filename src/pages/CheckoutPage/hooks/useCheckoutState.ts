
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

  const calculateDiscountedPrice = (originalPrice: number): number => {
    if (!appliedDiscount) return originalPrice;

    if (appliedDiscount.discount_type === 'percentage') {
      const discountAmount = (originalPrice * appliedDiscount.discount_value) / 100;
      return Math.max(0, originalPrice - discountAmount);
    } else {
      // Fixed amount discount
      return Math.max(0, originalPrice - appliedDiscount.discount_value);
    }
  };

  const getDiscountAmount = (originalPrice: number): number => {
    if (!appliedDiscount) return 0;

    if (appliedDiscount.discount_type === 'percentage') {
      return (originalPrice * appliedDiscount.discount_value) / 100;
    } else {
      return Math.min(appliedDiscount.discount_value, originalPrice);
    }
  };

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
    setAppliedDiscount,
    calculateDiscountedPrice,
    getDiscountAmount
  };
}

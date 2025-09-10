// Checkout page types and interfaces

// Use Supabase Auth User type for compatibility with useAuth
export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  first_name?: string | null;
  last_name?: string | null;
}

// Extended user interface for checkout context (allows null/undefined users)
export interface CheckoutUser extends AuthUser {
  id: string;
  email?: string;
}

// Subscription plan interface based on database schema
export interface SelectedPlan {
  id: string;
  name: string;
  description?: string | null;
  price_usd: number;
  is_lifetime: boolean;
  features: string[] | any; // Handle both array and JSON formats
  created_at: string;
  updated_at?: string; // Optional since it may not be returned from all queries
}

// Discount interface (centralized from useCheckoutState)
export interface AppliedDiscount {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
}

// Payment data interface for success handling
export interface PaymentData {
  paymentId?: string;
  transactionId?: string;
  paymentMethod?: string;
  orderId?: string;
}

// Hook return types
export interface UsePlanFetchingParams {
  planId: string | null;
  user: AuthUser | null; // Use compatible auth user type
  setSelectedPlan: (plan: SelectedPlan | null) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export interface UseAuthenticationFlowParams {
  user: AuthUser | null; // Use compatible auth user type
  authLoading: boolean;
  loading: boolean;
  selectedPlan: SelectedPlan | null;
  authCallback: string | null;
  setShowAuthForm: (show: boolean) => void;
}

export interface UseAuthenticationFlowReturn {
  handleAuthSuccess: () => void;
}

export interface UsePaymentHandlingParams {
  user: AuthUser | null; // Use compatible auth user type
  selectedPlan: SelectedPlan | null;
  processing: boolean;
  setProcessing: (processing: boolean) => void;
}

export interface UsePaymentHandlingReturn {
  handlePaymentSuccess: (paymentData: PaymentData) => Promise<void>;
  handlePaymentError: (error: any) => void;
}

// Checkout state interface (matching useCheckoutState)
export interface CheckoutState {
  selectedPlan: SelectedPlan | null;
  setSelectedPlan: (plan: SelectedPlan | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  processing: boolean;
  setProcessing: (processing: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  showAuthForm: boolean;
  setShowAuthForm: (show: boolean) => void;
  appliedDiscount: AppliedDiscount | null;
  setAppliedDiscount: (discount: AppliedDiscount | null) => void;
}
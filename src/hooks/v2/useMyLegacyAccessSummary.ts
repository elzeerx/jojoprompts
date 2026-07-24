import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MyLegacyAccessSummary {
  membership_type:
    | "ultimate" | "premium" | "standard" | "basic"
    | "standard_expired" | "basic_expired" | "cancelled_lifetime_review" | "none";
  lifetime: boolean;
  included_collection_keys: string[];
  basic_expiry: string | null;
  standard_expiry: string | null;
  has_expired_historical: boolean;
  manual_review_required: boolean;
  paypal_verified_credit_fils: number;
  upayments_verified_credit_fils: number;
  combined_legacy_credit_fils: number;
  lifetime_threshold_fils: number;
  remaining_lifetime_fils: number;
  payment_history_under_review: boolean;
  copy: { en: string; ar: string };
}

/**
 * Self-only. Reads the caller's proposed legacy classification and combined
 * verified legacy credit (strict PayPal + code-reconstructed KWD UPayments).
 */
export function useMyLegacyAccessSummary() {
  const { user } = useAuth();
  return useQuery<MyLegacyAccessSummary | null>({
    queryKey: ["v2", "my-legacy-access-summary", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("v2_my_legacy_access_summary");
      if (error) throw error;
      return (data as unknown as MyLegacyAccessSummary) ?? null;
    },
    staleTime: 60_000,
  });
}

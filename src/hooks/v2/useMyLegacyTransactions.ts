import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
export { reconstructLegacyUpaymentsFils } from "@/lib/v2/legacyTransactions";

export interface MyLegacyTransactionPlan {
  id: string;
  name: string;
  tier: string;
  price_usd: number;
  is_lifetime: boolean;
}

export interface MyLegacyTransaction {
  id: string;
  amount_usd: number;
  currency: string | null;
  status: string;
  payment_gateway: string | null;
  created_at: string;
  completed_at: string | null;
  paypal_order_id: string | null;
  paypal_payment_id: string | null;
  upayments_invoice_id: string | null;
  upayments_track_id: string | null;
  subscription_plans: MyLegacyTransactionPlan | null;
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Read-only historical payment history. The transactions RLS policy restricts
 * authenticated customers to rows where auth.uid() = user_id; the explicit
 * equality is defense in depth and keeps the query plan narrow.
 */
export function useMyLegacyTransactions() {
  const { user, loading: authLoading } = useAuth();
  return useQuery<MyLegacyTransaction[]>({
    queryKey: ["v2", "my-legacy-transactions", user?.id ?? "anon"],
    enabled: !authLoading && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, amount_usd, currency, status, payment_gateway, created_at, completed_at, paypal_order_id, paypal_payment_id, upayments_invoice_id, upayments_track_id, subscription_plans:plan_id(id,name,tier,price_usd,is_lifetime)",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        subscription_plans: firstRelated(row.subscription_plans),
      })) as MyLegacyTransaction[];
    },
  });
}

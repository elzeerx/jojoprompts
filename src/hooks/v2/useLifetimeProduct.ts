import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * The single active JOJO-FULL-LIBRARY-LIFETIME product row.
 * Server owns the actual price; we never compute a lifetime charge client-side.
 */
export function useLifetimeProduct() {
  return useQuery({
    queryKey: ["v2", "lifetime-product"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_type, price_fils, is_active, sku")
        .eq("product_type", "lifetime")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

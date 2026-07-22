import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { V2ResourceType } from "@/config/v2Flags";

export interface InactiveEntitlement {
  entitlement_id: string;
  resource_id: string;
  resource_slug: string;
  resource_type: V2ResourceType;
  title_en: string;
  title_ar: string | null;
  version_major: number | null;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  status: "revoked" | "expired" | "inactive";
}

export function useInactiveEntitlements() {
  const { user } = useAuth();
  return useQuery<InactiveEntitlement[]>({
    queryKey: ["v2", "inactive-entitlements", user?.id ?? "anon"],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_inactive_entitlements");
      if (error) throw error;
      return (data ?? []) as InactiveEntitlement[];
    },
  });
}

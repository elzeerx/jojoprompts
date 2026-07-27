import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EntitledResourceContent {
  ok: boolean;
  kind?: "prompt" | "package";
  resource_id?: string;
  resource_type?: string | null;
  prompt_text?: string | null;
  prompt_text_ar?: string | null;
  error?: string;
}

/**
 * Fetch protected legacy prompt content via the SECURITY DEFINER RPC
 * `v2_get_entitled_resource_content`. Enabled only when a signed-in user
 * has a confirmed entitlement for the resource. Never called for
 * public/unowned visitors — the query is disabled and no network request
 * fires.
 */
export function useEntitledResourceContent(
  resourceId: string | null | undefined,
  owned: boolean,
) {
  const { user } = useAuth();
  const enabled = !!user && !!resourceId && owned === true;
  return useQuery<EntitledResourceContent | null>({
    queryKey: ["v2", "entitled-content", user?.id ?? "anon", resourceId ?? "none"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "v2_get_entitled_resource_content",
        { p_resource_id: resourceId! },
      );
      if (error) throw error;
      return (data ?? null) as unknown as EntitledResourceContent | null;
    },
  });
}

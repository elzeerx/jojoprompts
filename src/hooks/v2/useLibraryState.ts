import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LibraryState {
  entitlements: Array<{
    id: string;
    resource_id: string | null;
    scope: "resource" | "library";
    grant_reason: string;
    version_major: number | null;
    granted_at: string;
    expires_at: string | null;
  }>;
  has_library_access: boolean;
  lifetime_progress_fils: number;
  lifetime_threshold_fils: number;
  lifetime_remaining_fils: number;
}

export function useLibraryState() {
  const { user } = useAuth();
  return useQuery<LibraryState | null>({
    queryKey: ["v2", "library-state", user?.id ?? "anon"],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.rpc("get_my_library_state");
      if (error) throw error;
      return data as unknown as LibraryState;
    },
    staleTime: 30_000,
    enabled: !!user,
  });
}

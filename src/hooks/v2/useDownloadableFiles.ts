import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface DownloadableFile {
  resource_id: string;
  resource_file_id: string;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  checksum: string | null;
  version: string;
  major_version: number;
  updated_at: string;
}

export function useDownloadableFiles(resourceId?: string | null) {
  const { user } = useAuth();
  return useQuery<DownloadableFile[]>({
    queryKey: ["v2", "downloadable-files", user?.id ?? "anon", resourceId ?? "all"],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_downloadable_files", {
        p_resource_id: resourceId ?? null,
      });
      if (error) throw error;
      return (data ?? []) as DownloadableFile[];
    },
  });
}

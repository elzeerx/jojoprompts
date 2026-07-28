import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useFreeAcquisition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (resourceId: string) => {
      const { data, error } = await supabase.rpc("grant_free_acquisition", {
        p_resource_id: resourceId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as {
        entitlement_id: string;
        resource_id: string;
        version_major: number;
        already_owned: boolean;
      };
    },
    onSuccess: (row) => {
      toast({
        title: row.already_owned ? "Already in your library" : "Added to library",
        description: row.already_owned
          ? "You already own this resource."
          : "Free resource successfully added.",
      });
      qc.invalidateQueries({ queryKey: ["v2"] });
    },
    onError: (err: unknown) => {
      const description =
        err instanceof Error ? err.message : "Please try again.";
      toast({
        variant: "destructive",
        title: "Could not add resource",
        description,
      });
    },
  });
}

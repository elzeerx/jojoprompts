import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

/**
 * Requests a short-lived signed URL for an entitled file via the
 * resource-download Edge Function. Storage paths never touch the client.
 */
export function useResourceDownload() {
  return useMutation({
    mutationFn: async (resourceFileId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "resource-download",
        {
          body: { resource_file_id: resourceFileId },
        },
      );
      if (error) {
        const message =
          (data as any)?.message ?? error.message ?? "Download failed.";
        throw new Error(message);
      }
      const payload = data as { url?: string; file_name?: string | null };
      if (!payload?.url) throw new Error("No download URL returned.");
      // Trigger the download in-browser
      const a = document.createElement("a");
      a.href = payload.url;
      if (payload.file_name) a.download = payload.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return payload;
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Download unavailable",
        description: err?.message ?? "Please try again.",
      });
    },
  });
}

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface DownloadPayload {
  url: string;
  file_name?: string | null;
}

interface InvokeError {
  message?: string;
}

/**
 * Uses per-file pending state via mutationKey — the caller reads
 * `mutation.variables` to disable only the file being fetched.
 */
export function useResourceDownload() {
  return useMutation({
    mutationFn: async (resourceFileId: string): Promise<DownloadPayload> => {
      const { data, error } = await supabase.functions.invoke(
        "resource-download",
        { body: { resource_file_id: resourceFileId } },
      );
      if (error) {
        const message =
          (data as InvokeError | null)?.message ??
          error.message ??
          "Download failed.";
        throw new Error(message);
      }
      const payload = data as DownloadPayload | null;
      if (!payload?.url) throw new Error("No download URL returned.");

      const a = document.createElement("a");
      a.href = payload.url;
      a.rel = "noopener";
      if (payload.file_name) a.download = payload.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return payload;
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Download unavailable",
        description: err.message ?? "Please try again.",
      });
    },
  });
}


import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { FILE_BUCKET } from "@/utils/buckets";

export async function downloadWorkflowFile(filePath: string, fileName: string) {
  try {
    const { data, error } = await supabase.storage
      .from(FILE_BUCKET)
      .download(filePath);

    if (error) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: "Failed to download the workflow file",
        variant: "destructive"
      });
      return;
    }

    // Create a blob URL and trigger download
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the blob URL
    URL.revokeObjectURL(url);
    
    toast({
      title: "Download started",
      description: `Downloading ${fileName}`
    });
  } catch (error) {
    console.error('Unexpected download error:', error);
    toast({
      title: "Download failed",
      description: "An unexpected error occurred while downloading",
      variant: "destructive"
    });
  }
}

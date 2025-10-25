import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { FILE_BUCKET } from "@/utils/buckets";
import { createLogger } from './logging';

const logger = createLogger('DOWNLOAD');

export async function downloadWorkflowFile(filePath: string, fileName: string) {
  try {
    // First, check if the file exists
    const { data: fileList, error: listError } = await supabase.storage
      .from(FILE_BUCKET)
      .list('', {
        search: filePath
      });

    if (listError) {
      logger.error('File check error', { error: listError, filePath });
      toast({
        title: "Download failed",
        description: "Unable to verify file existence. Please check your permissions.",
        variant: "destructive"
      });
      return;
    }

    if (!fileList || fileList.length === 0) {
      logger.error('File not found in storage', { filePath, fileName });
      toast({
        title: "File not found",
        description: `The workflow file "${fileName}" could not be found in storage. It may have been deleted or moved.`,
        variant: "destructive"
      });
      return;
    }

    // Download the file
    const { data, error } = await supabase.storage
      .from(FILE_BUCKET)
      .download(filePath);

    if (error) {
      logger.error('Download error', { error, filePath, fileName });
      
      // Provide specific error messages based on error type
      let errorMessage = "Failed to download the workflow file";
      if (error.message.includes('not found')) {
        errorMessage = `File "${fileName}" not found in storage`;
      } else if (error.message.includes('permission')) {
        errorMessage = "You don't have permission to download this file";
      } else if (error.message.includes('unauthorized')) {
        errorMessage = "Please log in to download files";
      }
      
      toast({
        title: "Download failed",
        description: errorMessage,
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
    logger.error('Unexpected download error', { error, filePath, fileName });
    toast({
      title: "Download failed",
      description: `An unexpected error occurred: ${error.message}`,
      variant: "destructive"
    });
  }
}

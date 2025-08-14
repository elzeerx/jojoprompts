import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface CopyOptions {
  successTitle?: string;
  successDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
  resetDelay?: number;
}

export function useCopyToClipboard(options: CopyOptions = {}) {
  const [hasCopied, setHasCopied] = useState(false);

  const {
    successTitle = "Copied!",
    successDescription = "Content copied to clipboard",
    errorTitle = "Copy failed",
    errorDescription = "Failed to copy to clipboard",
    resetDelay = 2000
  } = options;

  const copyToClipboard = async (text: string, customOptions?: Partial<CopyOptions>) => {
    try {
      await navigator.clipboard.writeText(text);
      setHasCopied(true);
      
      toast({
        title: customOptions?.successTitle || successTitle,
        description: customOptions?.successDescription || successDescription,
      });

      setTimeout(() => {
        setHasCopied(false);
      }, customOptions?.resetDelay || resetDelay);

      return true;
    } catch (error) {
      toast({
        variant: "destructive",
        title: customOptions?.errorTitle || errorTitle,
        description: customOptions?.errorDescription || errorDescription,
      });
      return false;
    }
  };

  return { copyToClipboard, hasCopied };
}
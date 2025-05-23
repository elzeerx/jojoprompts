
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export function useCopyPrompt() {
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = async (promptText: string) => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Prompt text has been copied to your clipboard"
      });
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast({
        title: "Error",
        description: "Failed to copy prompt to clipboard",
        variant: "destructive"
      });
    }
  };

  return { copied, handleCopyPrompt };
}

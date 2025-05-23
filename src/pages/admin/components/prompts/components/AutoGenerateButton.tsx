
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wand2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AutoGenerateButtonProps {
  promptText: string;
  onMetadataGenerated: (metadata: { style: string; tags: string[] }) => void;
  disabled?: boolean;
}

export function AutoGenerateButton({ promptText, onMetadataGenerated, disabled }: AutoGenerateButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAutoGenerate = async () => {
    if (!promptText.trim()) {
      toast({
        title: "No prompt text",
        description: "Please enter some prompt text first to generate metadata",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      console.log("AutoGenerateButton - Calling generate-metadata function with prompt:", promptText);
      
      const { data, error } = await supabase.functions.invoke('generate-metadata', {
        body: { prompt_text: promptText }
      });

      if (error) {
        console.error("AutoGenerateButton - Error calling generate-metadata function:", error);
        throw error;
      }

      console.log("AutoGenerateButton - Generated metadata from edge function:", data);

      // Updated to only handle style and tags (no category)
      const metadata = {
        style: data.style || "",
        tags: data.tags || []
      };

      console.log("AutoGenerateButton - Processed metadata (without category):", metadata);

      // Call the callback with the generated metadata
      onMetadataGenerated(metadata);

      toast({
        title: "Metadata generated!",
        description: `Style: ${metadata.style || "None"}, Tags: ${metadata.tags.length}`,
      });

    } catch (error) {
      console.error("AutoGenerateButton - Error generating metadata:", error);
      toast({
        title: "Generation failed",
        description: "Could not auto-generate metadata. You can still fill it manually.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleAutoGenerate}
      disabled={disabled || isGenerating || !promptText.trim()}
      className="flex items-center gap-2"
    >
      {isGenerating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Wand2 className="h-4 w-4" />
      )}
      {isGenerating ? "Generating..." : "Auto-generate"}
    </Button>
  );
}

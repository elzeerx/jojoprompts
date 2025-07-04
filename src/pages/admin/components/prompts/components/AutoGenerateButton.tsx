
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wand2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface AutoGenerateButtonProps {
  promptText: string;
  onMetadataGenerated: (metadata: { style: string; tags: string[] }) => void;
  disabled?: boolean;
}

export function AutoGenerateButton({ promptText, onMetadataGenerated, disabled }: AutoGenerateButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { canManagePrompts, loading: permissionsLoading } = useUserPermissions();

  // Don't render if user doesn't have permissions
  if (permissionsLoading) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={true}
        className="flex items-center gap-2"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking permissions...
      </Button>
    );
  }

  if (!canManagePrompts) {
    return null; // Hide the button for users without permissions
  }

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
      console.log("AutoGenerateButton - Starting metadata generation");
      console.log("AutoGenerateButton - User session check:", {
        promptLength: promptText.length
      });

      // Verify we have a valid session before making the call
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("AutoGenerateButton - Session error:", sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }
      
      if (!session) {
        console.error("AutoGenerateButton - No active session found");
        throw new Error("No active session found. Please log in again.");
      }

      console.log("AutoGenerateButton - Session verified, calling edge function");
      console.log("AutoGenerateButton - Session details:", {
        userId: session.user?.id?.substring(0, 8) + '***',
        tokenType: session.token_type,
        hasAccessToken: !!session.access_token
      });
      
      const { data, error } = await supabase.functions.invoke('generate-metadata', {
        body: { prompt_text: promptText }
      });

      if (error) {
        console.error("AutoGenerateButton - Edge function error:", error);
        console.error("AutoGenerateButton - Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
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
      
      // Provide more specific error messages
      let errorMessage = "Could not auto-generate metadata. You can still fill it manually.";
      if (error.message?.includes("Authentication")) {
        errorMessage = "Authentication error. Please refresh the page and try again.";
      } else if (error.message?.includes("Session")) {
        errorMessage = "Session expired. Please refresh the page and log in again.";
      } else if (error.message?.includes("Insufficient permissions")) {
        errorMessage = "You don't have permission to use auto-generate features.";
      } else if (error.message?.includes("OpenAI")) {
        errorMessage = "AI service temporarily unavailable. Please try again later.";
      }
      
      toast({
        title: "Generation failed",
        description: errorMessage,
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

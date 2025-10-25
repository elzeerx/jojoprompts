
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wand2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { callEdgeFunction } from "@/utils/edgeFunctions";
import { createLogger } from '@/utils/logging';
import { handleError, ErrorTypes } from '@/utils/errorHandler';

const logger = createLogger('AUTO_GENERATE');

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
      logger.info('Starting metadata generation', { promptLength: promptText.length });

      // Verify we have a valid session before making the call
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw ErrorTypes.AUTH_INVALID({ component: 'AutoGenerateButton' });
      }
      
      if (!session) {
        throw ErrorTypes.AUTH_REQUIRED({ component: 'AutoGenerateButton' });
      }

      logger.debug('Session verified, calling edge function', {
        userId: session.user?.id?.substring(0, 8) + '***',
        hasAccessToken: !!session.access_token
      });
      
      const data = await callEdgeFunction('generate-metadata', { prompt_text: promptText });

      logger.debug('Generated metadata from edge function', { 
        hasStyle: !!data.style, 
        tagsCount: data.tags?.length || 0 
      });

      // Updated to only handle style and tags (no category)
      const metadata = {
        style: data.style || "",
        tags: data.tags || []
      };

      logger.info('Processed metadata', { style: metadata.style, tagsCount: metadata.tags.length });

      // Call the callback with the generated metadata
      onMetadataGenerated(metadata);

      toast({
        title: "Metadata generated!",
        description: `Style: ${metadata.style || "None"}, Tags: ${metadata.tags.length}`,
      });

    } catch (error) {
      const appError = handleError(error, { component: 'AutoGenerateButton', action: 'generateMetadata' });
      logger.error('Error generating metadata', { error: appError });
      
      // Provide more specific error messages
      let errorMessage = "Could not auto-generate metadata. You can still fill it manually.";
      if (error.message?.includes("Authentication")) {
        errorMessage = "Authentication error. Please refresh the page and try again.";
      } else if (error.message?.includes("Session")) {
        errorMessage = "Session expired. Please refresh the page and log in again.";
      } else if (error.message?.includes("Insufficient permissions")) {
        errorMessage = "You don't have permission to use auto-generate features.";
      } else if (error.message?.includes("OpenAI API key") || error.message?.includes("not configured")) {
        errorMessage = "AI service is not properly configured. Please contact the administrator.";
      } else if (
        error.message?.toLowerCase().includes("model") ||
        error.message?.toLowerCase().includes("does not exist")
      ) {
        errorMessage = "AI model not available. Please update the edge function.";
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

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wand2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { callEdgeFunction } from "@/utils/edgeFunctions";

interface UseCaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  promptText: string;
  disabled?: boolean;
}

export function UseCaseField({ value, onChange, promptText, disabled }: UseCaseFieldProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { canManagePrompts, loading: permissionsLoading } = useUserPermissions();

  const handleAutoGenerate = async () => {
    if (!promptText.trim()) {
      toast({
        title: "No prompt text",
        description: "Please enter some prompt text first to generate use case",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      console.log("UseCaseField - Starting use case generation");
      console.log("UseCaseField - Prompt length:", promptText.length);

      console.log("UseCaseField - Calling edge function");
      
      const data = await callEdgeFunction('generate-use-case', { 
        prompt_text: promptText.trim()
      });

      console.log("UseCaseField - Edge function response:", { data });

      if (!data) {
        console.error("UseCaseField - No data returned from edge function");
        throw new Error("No response received from the service");
      }

      console.log("UseCaseField - Generated use case from edge function:", data);

      const useCase = data.use_case || "";
      
      if (!useCase.trim()) {
        console.warn("UseCaseField - Empty use case generated");
        toast({
          title: "Generated empty use case",
          description: "The AI couldn't determine a specific use case. Please try a more detailed prompt or enter manually.",
          variant: "destructive"
        });
        return;
      }
      
      onChange(useCase);

      toast({
        title: "Use case generated!",
        description: `Generated: ${useCase}`,
      });

    } catch (error) {
      console.error("UseCaseField - Error generating use case:", error);
      
      // Provide user-friendly error messages
      let errorMessage = "Could not auto-generate use case. You can still fill it manually.";
      
      if (error.message?.includes("Authentication") || error.message?.includes("Session")) {
        errorMessage = "Authentication error. Please refresh the page and try again.";
      } else if (error.message?.includes("Insufficient permissions")) {
        errorMessage = "You don't have permission to use auto-generate features.";
      } else if (error.message?.includes("OpenAI API key") || error.message?.includes("not configured")) {
        errorMessage = "AI service is not properly configured. Please contact the administrator.";
      } else if (error.message?.includes("AI service") || error.message?.includes("OpenAI")) {
        errorMessage = "AI service temporarily unavailable. Please try again later.";
      } else if (error.message?.includes("prompt text") || error.message?.includes("Invalid")) {
        errorMessage = "Invalid prompt text. Please check your input and try again.";
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        errorMessage = "Network error. Please check your connection and try again.";
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
    <div className="grid grid-cols-4 items-center gap-4">
      <Label htmlFor="use_case" className="text-right">
        Use Case
      </Label>
      <div className="col-span-3 space-y-2">
        <div className="flex gap-2">
          <Input
            id="use_case"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g., Writing Assistant, Code Helper"
            disabled={disabled}
            className="flex-1"
          />
          {canManagePrompts && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoGenerate}
              disabled={disabled || isGenerating || !promptText.trim() || permissionsLoading}
              className="flex items-center gap-2 shrink-0"
            >
              {isGenerating || permissionsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {isGenerating ? "Generating..." : permissionsLoading ? "Checking..." : "Auto-generate"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
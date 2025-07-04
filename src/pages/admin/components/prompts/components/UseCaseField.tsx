import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wand2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UseCaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  promptText: string;
  disabled?: boolean;
}

export function UseCaseField({ value, onChange, promptText, disabled }: UseCaseFieldProps) {
  const [isGenerating, setIsGenerating] = useState(false);

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

      // Verify we have a valid session before making the call
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("UseCaseField - Session error:", sessionError);
        throw new Error(`Session error: ${sessionError.message}`);
      }
      
      if (!session) {
        console.error("UseCaseField - No active session found");
        throw new Error("No active session found. Please log in again.");
      }

      console.log("UseCaseField - Session verified, calling edge function");
      
      const { data, error } = await supabase.functions.invoke('generate-use-case', {
        body: { prompt_text: promptText }
      });

      if (error) {
        console.error("UseCaseField - Edge function error:", error);
        throw error;
      }

      console.log("UseCaseField - Generated use case from edge function:", data);

      const useCase = data.use_case || "";
      onChange(useCase);

      toast({
        title: "Use case generated!",
        description: useCase ? `Generated: ${useCase.substring(0, 50)}...` : "Use case generated successfully",
      });

    } catch (error) {
      console.error("UseCaseField - Error generating use case:", error);
      
      // Provide more specific error messages
      let errorMessage = "Could not auto-generate use case. You can still fill it manually.";
      if (error.message?.includes("Authentication")) {
        errorMessage = "Authentication error. Please refresh the page and try again.";
      } else if (error.message?.includes("Session")) {
        errorMessage = "Session expired. Please refresh the page and log in again.";
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutoGenerate}
            disabled={disabled || isGenerating || !promptText.trim()}
            className="flex items-center gap-2 shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {isGenerating ? "Generating..." : "Auto-generate"}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PromptDialog } from "@/pages/admin/components/prompts/PromptDialog";
import { PromptTypeMenu } from "./prompt-type-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import type { PromptRow } from "@/types";
import { cn } from "@/lib/utils";

interface FloatingAddPromptButtonProps {
  reloadPrompts: () => Promise<void>;
  className?: string;
}

export function FloatingAddPromptButton({ reloadPrompts, className }: FloatingAddPromptButtonProps) {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [promptType, setPromptType] = useState<"text" | "image" | "image-selection" | "workflow">("image");
  const [category, setCategory] = useState<string>("ChatGPT");
  const navigate = useNavigate();

  // Only render for admin users
  if (!user || !isAdmin) return null;

  const handleSelectPromptType = (type: "text" | "image" | "image-selection" | "workflow", selectedCategory: string) => {
    setPromptType(type);
    setCategory(selectedCategory);
    setOpen(true);
  };

  const handleSave = async (prompt: Partial<PromptRow>) => {
    try {
      // Check if required fields are present
      if (!prompt.title || !prompt.prompt_text) {
        toast({
          title: "Error",
          description: "Title and prompt text are required fields",
          variant: "destructive",
        });
        return;
      }

      // Ensure the category is always set
      const metadata = {
        ...(prompt.metadata || {}),
        category: prompt.metadata?.category || category // Use selected category as default
      };

      // Use all the data from the prompt object directly
      const { error } = await supabase
        .from("prompts")
        .insert({
          title: prompt.title,
          prompt_text: prompt.prompt_text,
          user_id: user.id,
          prompt_type: promptType,
          metadata: metadata,
          image_path: (promptType === "image" || promptType === "image-selection") ? prompt.image_path : null,
          default_image_path: promptType === "text" ? prompt.default_image_path : null
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Prompt created successfully",
      });

      // Close the dialog
      setOpen(false);
      
      // Reload prompts to refresh the list
      await reloadPrompts();
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast({
        title: "Error",
        description: "Failed to save prompt. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <PromptTypeMenu
        onSelect={handleSelectPromptType}
        trigger={
          <button
            type="button"
            aria-label="Add Prompt"
            title="Add Prompt"
            className={cn(
              "fixed z-50 bottom-8 right-8 md:bottom-10 md:right-10 transition-transform animate-fade-in hover:scale-110 peer",
              className
            )}
          >
            <div className="group relative flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full">
              {/* Animated glow effect */}
              <div 
                className="absolute inset-0 rounded-full opacity-70 blur-md transition-all duration-300 group-hover:opacity-100"
                style={{ 
                  background: "radial-gradient(circle, rgba(196, 157, 104, 0.5) 0%, rgba(196, 157, 104, 0.2) 70%, transparent 100%)"
                }}
              />
              
              {/* Button background with subtle gradient */}
              <div 
                className="absolute inset-0 rounded-full border border-warm-gold/30 bg-gradient-to-br from-white to-soft-bg shadow-lg transition-all duration-300 group-hover:border-warm-gold/50 group-hover:shadow-warm-gold/20"
              />
              
              {/* Plus icon */}
              <PlusCircle
                size={52}
                strokeWidth={1.5}
                className="relative z-10 text-warm-gold transition-all duration-300 group-hover:text-warm-gold/90 group-hover:rotate-90"
              />
            </div>
          </button>
        }
      />

      <PromptDialog
        open={open}
        onOpenChange={setOpen}
        initial={null}
        promptType={promptType}
        category={category}
        onSave={handleSave}
      />
    </>
  );
};


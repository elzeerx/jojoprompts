
import { type PromptRow } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function usePromptDeletion(setPrompts: React.Dispatch<React.SetStateAction<PromptRow[]>>, reloadPrompts: () => Promise<void>) {
  const handleDeletePrompt = async (promptId: string) => {
    try {
      setPrompts((prev) => prev.filter(p => p.id !== promptId));
      
      const { error } = await supabase
        .from("prompts")
        .delete()
        .eq("id", promptId);
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Prompt deleted successfully",
      });
      reloadPrompts();
    } catch (error) {
      reloadPrompts();
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive"
      });
    }
  };

  return { handleDeletePrompt };
}

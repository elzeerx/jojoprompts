
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { AdminPromptCard } from "./components/prompts/AdminPromptCard";
import { PromptWizardDialog, EditPromptButton } from "@/components/prompts";
import { type PromptRow } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface PromptsManagementProps {
  favoritedPromptIds?: string[];
}

export default function PromptsManagement({ favoritedPromptIds = [] }: PromptsManagementProps) {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  
  const fetchPrompts = async () => {
    setIsLoading(true);
    try {
      console.log("PromptsManagement - Fetching prompts...");
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .returns<PromptRow[]>()
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      console.log("PromptsManagement - Fetched prompts:", data);
      console.log("PromptsManagement - Sample prompt metadata:", data?.[0]?.metadata);
      return data || [];
    } catch (error) {
      console.error("PromptsManagement - Error fetching prompts:", error);
      toast({
        title: "Error",
        description: "Failed to load prompts",
        variant: "destructive"
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };
  
  const updatePromptsState = (data: PromptRow[] | null) => {
    if (data) {
      console.log("PromptsManagement - Updating prompts state with:", data);
      console.log("PromptsManagement - First prompt metadata in update:", data[0]?.metadata);
      setPrompts(data);
    }
  };
  
  useEffect(() => {
    let mounted = true;
    fetchPrompts().then((data) => {
      if (mounted) {
        setPrompts(data);
      }
    });
    
    return () => { mounted = false; };
  }, []);
  
  const handlePromptComplete = async () => {
    console.log("PromptsManagement - Prompt saved successfully, refreshing prompts...");
    const freshPrompts = await fetchPrompts();
    console.log("PromptsManagement - Fresh prompts after save:", freshPrompts);
    updatePromptsState(freshPrompts);
  };
  
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
    } catch (error) {
      console.error("PromptsManagement - Error deleting prompt:", error);
      
      // Reload the prompts to restore the state
      fetchPrompts().then(updatePromptsState);
      
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive"
      });
    }
  };
  
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-dark-base">Prompts Management</h2>
        <PromptWizardDialog
          trigger={
            <Button className="bg-warm-gold hover:bg-warm-gold/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Prompt
            </Button>
          }
          mode="create"
          onComplete={handlePromptComplete}
        />
      </div>
      
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block">
            <Loader2 className="h-8 w-8 animate-spin text-warm-gold" />
          </div>
        </div>
      ) : prompts.length === 0 ? (
        <div className="text-center py-8 bg-soft-bg/30 rounded-xl border border-warm-gold/20 p-8">
          <p className="text-muted-foreground mb-4">No prompts found</p>
          <PromptWizardDialog
            trigger={
              <Button className="bg-warm-gold hover:bg-warm-gold/90">
                Add Your First Prompt
              </Button>
            }
            mode="create"
            onComplete={handlePromptComplete}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prompts.map((prompt) => (
            <AdminPromptCard
              key={prompt.id}
              prompt={prompt}
              onEdit={() => {}} // No longer needed, EditPromptButton handles it
              onDelete={handleDeletePrompt}
              initiallyFavorited={favoritedPromptIds.includes(prompt.id)}
              onEditSuccess={handlePromptComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}


import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AdminPromptCard } from "./components/prompts/AdminPromptCard";
import { PromptDialog } from "./components/prompts/PromptDialog";
import { type PromptRow } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PromptsManagementProps {
  favoritedPromptIds?: string[];
}

export default function PromptsManagement({ favoritedPromptIds = [] }: PromptsManagementProps) {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptRow | null>(null);
  
  const fetchPrompts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setPrompts(data || []);
    } catch (error) {
      console.error("Error fetching prompts:", error);
      toast({
        title: "Error",
        description: "Failed to load prompts",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchPrompts();
  }, []);
  
  const handleAddPrompt = () => {
    setSelectedPrompt(null);
    setIsDialogOpen(true);
  };
  
  const handleEditPrompt = (promptId: string) => {
    const prompt = prompts.find(p => p.id === promptId);
    if (prompt) {
      setSelectedPrompt(prompt);
      setIsDialogOpen(true);
    }
  };
  
  const handleDeletePrompt = async (promptId: string) => {
    try {
      const { error } = await supabase
        .from("prompts")
        .delete()
        .eq("id", promptId);
      
      if (error) throw error;
      
      // Remove from local state
      setPrompts(prompts.filter(p => p.id !== promptId));
      
      toast({
        title: "Success",
        description: "Prompt deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting prompt:", error);
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive"
      });
    }
  };
  
  const handleSavePrompt = async (prompt: Partial<PromptRow>) => {
    setIsDialogOpen(false);
    
    try {
      if (selectedPrompt) {
        // Update existing prompt
        const { error } = await supabase
          .from("prompts")
          .update(prompt)
          .eq("id", selectedPrompt.id);
        
        if (error) throw error;
        
        // Update local state
        setPrompts(prompts.map(p => 
          p.id === selectedPrompt.id ? { ...p, ...prompt } : p
        ));
        
        toast({
          title: "Success",
          description: "Prompt updated successfully",
        });
      } else {
        // Create new prompt
        const { data, error } = await supabase
          .from("prompts")
          .insert(prompt)
          .select()
          .single();
        
        if (error) throw error;
        
        // Add to local state
        setPrompts([data, ...prompts]);
        
        toast({
          title: "Success",
          description: "Prompt created successfully",
        });
      }
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast({
        title: "Error",
        description: "Failed to save prompt",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Prompts Management</h2>
        <Button onClick={handleAddPrompt}>
          <Plus className="mr-2 h-4 w-4" />
          Add Prompt
        </Button>
      </div>
      
      {isLoading ? (
        <div className="text-center py-8">Loading prompts...</div>
      ) : prompts.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">No prompts found</p>
          <Button onClick={handleAddPrompt}>Add Your First Prompt</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prompts.map((prompt) => (
            <AdminPromptCard
              key={prompt.id}
              prompt={prompt}
              onEdit={handleEditPrompt}
              onDelete={handleDeletePrompt}
              initiallyFavorited={favoritedPromptIds.includes(prompt.id)}
            />
          ))}
        </div>
      )}
      
      <PromptDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        prompt={selectedPrompt}
        onSave={handleSavePrompt}
      />
    </div>
  );
}

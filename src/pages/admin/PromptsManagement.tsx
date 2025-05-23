import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AdminPromptCard } from "./components/prompts/AdminPromptCard";
import { PromptDialog } from "./components/prompts/PromptDialog";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PromptRow | null>(null);
  const { user } = useAuth();
  
  const fetchPrompts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .returns<PromptRow[]>()
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching prompts:", error);
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
  
  const handleAddPrompt = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  
  const handleEditPrompt = (promptId: string) => {
    const prompt = prompts.find(p => p.id === promptId);
    if (prompt) {
      setEditing(prompt);
      setDialogOpen(true);
    }
  };
  
  const handleDeletePrompt = async (promptId: string) => {
    try {
      setPrompts((prev) => prev.filter(p => p.id !== promptId));
      
      const { error } = await supabase
        .from("prompts")
        .delete()
        .eq("id", promptId);
      
      if (error) throw error;
      
      supabase
        .from("prompts")
        .select("*")
        .order("created_at", { ascending: false })
        .returns<PromptRow[]>()
        .then(({ data }) => updatePromptsState(data));
      
      toast({
        title: "Success",
        description: "Prompt deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting prompt:", error);
      
      fetchPrompts().then(updatePromptsState);
      
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive"
      });
    }
  };
  
  const handleSave = async (prompt: Partial<PromptRow>) => {
    setDialogOpen(false);
    
    try {
      if (editing) {
        const { error } = await supabase
          .from("prompts")
          .update(prompt)
          .eq("id", editing.id);
        
        if (error) throw error;
        
        setPrompts(prompts.map(p => 
          p.id === editing.id ? { ...p, ...prompt } : p
        ));
        
        toast({
          title: "Success",
          description: "Prompt updated successfully",
        });
      } else {
        const payload = {
          ...prompt,
          user_id: user?.id
        };
        
        const { data, error } = await supabase
          .from("prompts")
          .insert(payload as any)
          .select()
          .returns<PromptRow[]>()
          .single();
        
        if (error) throw error;
        
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
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          fetchPrompts().then(updatePromptsState);
          setDialogOpen(false);
        }}
        editingPrompt={editing}
        promptType={editing?.prompt_type || "text"}
      />
    </div>
  );
}

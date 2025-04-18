
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { type PromptRow } from "@/types";
import { AddPromptDialog } from "./components/prompts/AddPromptDialog";
import { AdminPromptCard } from "./components/prompts/AdminPromptCard";

export default function PromptsManagement() {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .order("created_at", { ascending: false })
        .returns<PromptRow[]>();

      if (error) throw error;
      setPrompts(data || []);
    } catch (error) {
      console.error("Error fetching prompts:", error);
      toast({
        title: "Error",
        description: "Failed to load prompts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    try {
      const { error } = await supabase.from("prompts").delete().match({ id });

      if (error) throw error;

      setPrompts((prev) => prev.filter((p) => p.id !== id));
      toast({
        title: "Success",
        description: "Prompt deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting prompt:", error);
      toast({
        title: "Error",
        description: "Failed to delete prompt",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Manage Prompts</h2>
        <Button onClick={() => setIsDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Prompt
        </Button>
      </div>

      {loading ? (
        <p>Loading prompts...</p>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {prompts.map((prompt) => (
            <AdminPromptCard
              key={prompt.id}
              prompt={prompt}
              onEdit={(id) => console.log("Edit prompt:", id)}
              onDelete={handleDeletePrompt}
            />
          ))}
        </div>
      )}

      <AddPromptDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onPromptAdded={fetchPrompts}
      />
    </div>
  );
}

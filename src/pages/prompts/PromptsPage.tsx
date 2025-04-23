
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";
import { type Prompt, type PromptRow } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

import { usePromptsData } from "./usePromptsData";
import { PromptsHeader } from "./PromptsHeader";
import { PromptsFilters } from "./PromptsFilters";
import { PromptsContent } from "./PromptsContent";

export default function PromptsPage() {
  const { loading: authLoading, session } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const [selectedPrompt, setSelectedPrompt] = useState<PromptRow | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Fetch prompts & categories
  const { prompts, setPrompts, categories, isLoading, error, reloadPrompts } = usePromptsData({ authLoading, session });

  if (!authLoading && !session) {
    navigate("/login");
  }

  // Filtering logic
  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = searchQuery === "" ||
      prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.prompt_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.metadata.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = category === "all" || prompt.metadata.category === category;
    return matchesSearch && matchesCategory;
  });

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
        .then(({ data }) => {
          if (data) {
            const transformedData = data.map((item) => ({
              id: item.id,
              user_id: item.user_id,
              title: item.title,
              prompt_text: item.prompt_text,
              image_path: item.image_path,
              created_at: item.created_at || "",
              metadata: {
                category: (item.metadata as any)?.category ?? undefined,
                style: (item.metadata as any)?.style ?? undefined,
                tags: Array.isArray((item.metadata as any)?.tags)
                  ? (item.metadata as any).tags
                  : [],
              },
            }));
          }
        });
      
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

  return (
    <div className="container px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
      <PromptsHeader
        view={view}
        setView={setView}
        selectedPromptsLength={0} // No selection logic
        onClearSelections={() => {}} // No-op
      />

      <PromptsFilters
        category={category}
        setCategory={setCategory}
        categories={categories}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        view={view}
        setView={setView}
      />

      <PromptsContent
        view={view}
        filteredPrompts={filteredPrompts}
        isLoading={isLoading}
        error={error}
        searchQuery={searchQuery}
        category={category}
        onClearFilters={() => {
          setSearchQuery("");
          setCategory("all");
        }}
        selectedPrompts={[]} // Not used anymore, safe to pass empty
        onSelectPrompt={() => {}} // Not used anymore, safe to noop
      />

      {selectedPrompt && (
        <PromptDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          prompt={selectedPrompt}
          promptList={prompts as PromptRow[]}
        />
      )}
    </div>
  );
}

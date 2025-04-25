
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
  const [promptType, setPromptType] = useState<"image" | "text" | "all">("image");

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
    const matchesType = promptType === "all" || prompt.prompt_type === promptType;
    return matchesSearch && matchesCategory && matchesType;
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
    <div className="w-full bg-background">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-8">
        <PromptsHeader
          view={view}
          setView={setView}
          selectedPromptsLength={0}
          onClearSelections={() => {}}
          promptType={promptType}
          setPromptType={setPromptType}
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
          promptType={promptType}
          onClearFilters={() => {
            setSearchQuery("");
            setCategory("all");
            setPromptType("all");
          }}
          selectedPrompts={[]}
          onSelectPrompt={() => {}}
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
    </div>
  );
}

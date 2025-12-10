import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PromptsFilters } from "../PromptsFilters";
import { ModernPromptCard } from "@/components/ui/modern-prompt-card";
import type { PromptRow } from "@/types/prompts";
import type { Prompt } from "@/types";
import type { usePromptFilters } from "@/hooks/usePromptFilters";
import { useCategories } from "@/hooks/useCategories";
import { usePromptAccess } from "@/hooks/usePromptAccess";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { PromptService } from "@/services/PromptService";
import { toast } from "@/hooks/use-toast";

interface RefactoredPromptsContentProps {
  prompts: PromptRow[];
  isLoading: boolean;
  error: string | null;
  filters: ReturnType<typeof usePromptFilters>;
  onReload: () => void;
}

export function RefactoredPromptsContent({
  prompts,
  isLoading,
  error,
  filters,
  onReload
}: RefactoredPromptsContentProps) {
  const navigate = useNavigate();
  const { t, isRTL } = useTranslation();
  const { categories } = useCategories();
  const { isAdmin, checkPromptAccess } = usePromptAccess();
  const [view, setView] = useState<"grid" | "list">("grid");

  const categoryNames = categories.map(cat => cat.name);
  
  // Process prompts using the filters
  const processedPrompts = filters.processPrompts(prompts);

  const handleDeletePrompt = async (promptId: string) => {
    try {
      const result = await PromptService.deletePrompt(promptId);
      if (result.success) {
        toast({
          title: "Prompt deleted",
          description: "The prompt has been successfully deleted.",
        });
        onReload();
      } else {
        toast({
          variant: "destructive",
          title: "Delete failed",
          description: result.error || "Failed to delete prompt",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "An unexpected error occurred",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground mb-3">{t("prompts.loading")}</p>
          <div className="h-1.5 w-64 bg-secondary overflow-hidden">
            <div className="h-full bg-warm-gold animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-destructive mb-6 text-lg break-words text-center max-w-2xl px-4">
            {error}
          </p>
          <Button
            variant="outline"
            className="px-8 py-2 text-base font-bold border-warm-gold/20"
            onClick={onReload}
          >
            {t("prompts.retry")}
          </Button>
        </div>
      </div>
    );
  }

  const handleUpgradeClick = () => {
    navigate('/pricing');
  };

  return (
    <div className="container mx-auto px-4 pt-20 lg:pt-24 pb-8">
      <PromptsFilters
        category={filters.filters.category}
        setCategory={filters.setCategory}
        categories={categoryNames}
        searchQuery={filters.filters.searchQuery}
        setSearchQuery={filters.setSearchQuery}
        view={view}
        setView={setView}
      />

      {processedPrompts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground mb-6 text-lg text-center max-w-2xl px-4 leading-relaxed">
            {filters.hasActiveFilters
              ? t("prompts.noPromptsFound")
              : t("prompts.noPromptsAvailable")}
          </p>
          {filters.hasActiveFilters && (
            <Button
              variant="outline"
              className="px-8 py-2 text-base font-bold border-warm-gold/20"
              onClick={filters.clearFilters}
            >
              {t("prompts.clearFilters")}
            </Button>
          )}
        </div>
      ) : (
        <div className={cn(
          "grid gap-6",
          view === "grid" 
            ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
            : "grid-cols-1 max-w-4xl mx-auto"
        )}>
        {processedPrompts.map((prompt) => (
            <ModernPromptCard
              key={prompt.id}
              prompt={prompt as unknown as Prompt}
              isAdmin={isAdmin}
              onDelete={handleDeletePrompt}
              onEditSuccess={onReload}
              isLocked={checkPromptAccess(prompt)}
              onUpgradeClick={handleUpgradeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
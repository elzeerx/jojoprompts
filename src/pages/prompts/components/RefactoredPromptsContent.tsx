import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PromptsFilters } from "../PromptsFilters";
import { PromptCard } from "@/components/ui/prompt-card";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";
import { CategoryHeader } from "./CategoryHeader";
import { SkeletonPromptCard } from "@/components/ui/SkeletonPromptCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCategories } from "@/hooks/useCategories";
import { extractPromptMetadata } from "@/utils/promptUtils";
import type { PromptRow } from "@/types/prompts";
import type { usePromptFilters } from "@/hooks/usePromptFilters";

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
  const { isAdmin } = useAuth();
  const [selectedPrompt, setSelectedPrompt] = useState<PromptRow | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  // Process prompts using the filters
  const processedPrompts = filters.processPrompts(prompts);
  const currentCategory = filters.filters.category || "All";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <CategoryHeader category={currentCategory} />
        <div className="container py-6">
          <div className="space-y-6">
            <div className="h-16 bg-muted rounded-lg animate-pulse"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonPromptCard key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <CategoryHeader category={currentCategory} />
        <div className="container py-6">
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-destructive mb-6 text-lg">{error}</p>
            <Button
              variant="outline"
              className="px-8 py-2 text-base font-bold border-warm-gold/20"
              onClick={onReload}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const openPromptDetails = (prompt: PromptRow) => {
    setSelectedPrompt(prompt);
    setDetailsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <CategoryHeader category={currentCategory} promptCount={processedPrompts.length} />
      
      <div className="container py-6 space-y-6">
        <PromptsFilters
          category={filters.filters.category}
          setCategory={filters.setCategory}
          searchQuery={filters.filters.searchQuery}
          setSearchQuery={filters.setSearchQuery}
          view={view}
          setView={setView}
        />

        {processedPrompts.length === 0 ? (
          <EmptyState 
            category={currentCategory}
            hasFilters={filters.hasActiveFilters}
            onClearFilters={filters.clearFilters}
            isAdmin={isAdmin}
          />
        ) : (
          <div className={
            view === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
              : "space-y-4"
          }>
            {processedPrompts.map((prompt) => {
              const metadata = extractPromptMetadata(prompt);
              
              return (
                <div
                  key={prompt.id}
                  onClick={() => {
                    setSelectedPrompt(prompt);
                    setDetailsDialogOpen(true);
                  }}
                  className={view === 'list' ? "flex flex-row" : ""}
                >
                  <PromptCard prompt={prompt} />
                </div>
              );
            })}
          </div>
        )}

        {selectedPrompt && (
          <PromptDetailsDialog
            open={detailsDialogOpen}
            onOpenChange={setDetailsDialogOpen}
            prompt={selectedPrompt}
          />
        )}
      </div>
    </div>
  );
}
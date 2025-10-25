import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PromptsFilters } from "../PromptsFilters";
import { PromptCard } from "@/components/ui/prompt-card";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";
import type { PromptRow } from "@/types/prompts";
import type { Prompt } from "@/types";
import type { usePromptFilters } from "@/hooks/usePromptFilters";
import { useCategories } from "@/hooks/useCategories";
import { useAuth } from "@/contexts/AuthContext";
import { useUserSubscription } from "@/hooks/useUserSubscription";
import { getSubscriptionTier, isPromptLocked } from "@/utils/subscription";
import { isPrivilegedUser, isAdmin as isAdminRole } from "@/utils/auth";

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
  const { categories } = useCategories();
  const { user, userRole } = useAuth();
  const { userSubscription } = useUserSubscription(user?.id);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptRow | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  // Determine user privileges and subscription tier
  const isPrivileged = isPrivilegedUser(userRole);
  const userTier = getSubscriptionTier(userSubscription?.subscription_plans?.name);
  const isAdmin = isAdminRole(userRole);

  const categoryNames = categories.map(cat => cat.name);
  
  // Process prompts using the filters
  const processedPrompts = filters.processPrompts(prompts);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground mb-3">Loading prompts...</p>
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
    );
  }

  const openPromptDetails = (prompt: PromptRow) => {
    setSelectedPrompt(prompt);
    setDetailsDialogOpen(true);
  };

  const handleUpgradeClick = () => {
    navigate('/pricing');
  };

  return (
    <div className="container mx-auto px-4 py-8">
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
          <p className="text-muted-foreground mb-6 text-lg">
            {filters.hasActiveFilters
              ? "No prompts found matching your search."
              : "No prompts available."}
          </p>
          {filters.hasActiveFilters && (
            <Button
              variant="outline"
              className="px-8 py-2 text-base font-bold border-warm-gold/20"
              onClick={filters.clearFilters}
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className={`grid gap-6 ${
          view === "grid" 
            ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
            : "grid-cols-1 max-w-4xl mx-auto"
        }`}>
          {processedPrompts.map((prompt) => {
            const promptIsLocked = isPromptLocked(prompt.prompt_type || 'text', userTier, isPrivileged);
            
            return (
              <PromptCard
                key={prompt.id}
                prompt={prompt as unknown as Prompt}
                isSelected={false}
                onSelect={() => openPromptDetails(prompt)}
                isAdmin={isAdmin}
                onEdit={() => {}}
                onDelete={() => {}}
                isLocked={promptIsLocked}
                onUpgradeClick={handleUpgradeClick}
              />
            );
          })}
        </div>
      )}

      {selectedPrompt && (
        <PromptDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          prompt={selectedPrompt as unknown as Prompt}
        />
      )}
    </div>
  );
}
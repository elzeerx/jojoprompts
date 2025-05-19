
import { Button } from "@/components/ui/button";
import { type Prompt } from "@/types";
import { MagazinePromptCard } from "@/components/ui/magazine-prompt-card";
import { useState } from "react";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";

interface PromptsContentProps {
  view: "grid" | "list";
  filteredPrompts: Prompt[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  category: string;
  promptType: "image" | "text" | "all";
  onClearFilters: () => void;
  selectedPrompts?: string[];
  onSelectPrompt?: (id: string) => void;
}

export function PromptsContent({
  view, filteredPrompts, isLoading, error, searchQuery, category, promptType,
  onClearFilters
}: PromptsContentProps) {
  const isGridView = view === "grid";
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Array of background colors from our palette to rotate through
  const bgColors = [
    'bg-soft-bg', 'bg-warm-gold/10', 'bg-muted-teal/10'
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground mb-3">Loading prompts...</p>
        <div className="h-1.5 w-64 bg-secondary overflow-hidden">
          <div className="h-full bg-warm-gold animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-destructive mb-6 text-lg">{error}</p>
        <Button
          variant="outline"
          className="px-8 py-2 text-base font-bold border-warm-gold/20"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (filteredPrompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground mb-6 text-lg">
          {searchQuery || category !== "all"
            ? "No prompts found matching your search."
            : "No prompts available."}
        </p>
        {(searchQuery || category !== "all") && (
          <Button
            variant="outline"
            className="px-8 py-2 text-base font-bold border-warm-gold/20"
            onClick={onClearFilters}
          >
            Clear Filters
          </Button>
        )}
      </div>
    );
  }

  // Group prompts into sets of 3 for the magazine layout
  const groupedPrompts = [];
  for (let i = 0; i < filteredPrompts.length; i += 3) {
    const group = filteredPrompts.slice(i, Math.min(i + 3, filteredPrompts.length));
    groupedPrompts.push(group);
  }

  const openPromptDetails = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setDetailsDialogOpen(true);
  };

  return (
    <>
      <div className="mt-8 space-y-8">
        {groupedPrompts.map((group, groupIndex) => (
          <div key={groupIndex} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {group.map((prompt, index) => (
              <MagazinePromptCard
                key={prompt.id}
                prompt={prompt}
                isLarge={index === 0 && group.length > 1}
                colorIndex={(groupIndex * 3 + index) % bgColors.length}
                bgColors={bgColors}
                onCardClick={() => openPromptDetails(prompt)}
                className={index === 0 && group.length > 1 ? "md:col-span-1 md:row-span-2" : ""}
              />
            ))}
          </div>
        ))}
      </div>
      
      {selectedPrompt && (
        <PromptDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          prompt={selectedPrompt}
        />
      )}
    </>
  );
}

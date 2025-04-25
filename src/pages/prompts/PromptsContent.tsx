
import { PromptCard } from "@/components/ui/prompt-card";
import { TextPromptCard } from "@/components/ui/text-prompt-card";
import { Button } from "@/components/ui/button";
import { type Prompt } from "@/types";

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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-2">Loading prompts...</p>
        <div className="h-1 w-64 bg-secondary overflow-hidden rounded-full">
          <div className="h-full bg-primary animate-pulse rounded-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">{error}</p>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (filteredPrompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground mb-4">
          {searchQuery || category !== "all"
            ? "No prompts found matching your search."
            : "No prompts available."}
        </p>
        {(searchQuery || category !== "all") && (
          <Button
            variant="outline"
            onClick={onClearFilters}
          >
            Clear Filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={isGridView
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      : "flex flex-col gap-3"
    }>
      {filteredPrompts.map((prompt) => (
        prompt.prompt_type === 'text' ? (
          <TextPromptCard key={prompt.id} prompt={prompt} />
        ) : (
          <PromptCard key={prompt.id} prompt={prompt} />
        )
      ))}
    </div>
  );
}


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
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-muted-foreground mb-3 font-mono">Loading prompts...</p>
        <div className="h-1.5 w-64 bg-secondary overflow-hidden rounded-none">
          <div className="h-full bg-primary animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-destructive mb-6 font-mono text-lg">{error}</p>
        <Button
          variant="outline"
          className="rounded-none px-8 py-2 text-base font-bold"
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
        <p className="text-muted-foreground mb-6 font-mono text-lg">
          {searchQuery || category !== "all"
            ? "No prompts found matching your search."
            : "No prompts available."}
        </p>
        {(searchQuery || category !== "all") && (
          <Button
            variant="outline"
            className="rounded-none px-8 py-2 text-base font-bold"
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
      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
      : "flex flex-col gap-5"
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

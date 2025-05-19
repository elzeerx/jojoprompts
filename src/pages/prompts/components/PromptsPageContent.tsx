
import { useState } from "react";
import { PromptsHeader } from "../PromptsHeader";
import { PromptsFilters } from "../PromptsFilters";
import { PromptsContent } from "../PromptsContent";

interface PromptsPageContentProps {
  prompts: any[];
  categories: string[];
  isLoading: boolean;
  error: string | null;
  reloadPrompts: () => Promise<void>;
}

export function PromptsPageContent({
  prompts,
  categories,
  isLoading,
  error,
  reloadPrompts,
}: PromptsPageContentProps) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [promptType, setPromptType] = useState<"image" | "text" | "all">("all");

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

  return (
    <div className="container max-w-[1200px] mx-auto px-4 sm:px-6 py-10">
      <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 md:p-8 shadow-xl">
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
      </div>
    </div>
  );
}

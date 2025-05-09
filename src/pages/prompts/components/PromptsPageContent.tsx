
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
    </div>
  );
}

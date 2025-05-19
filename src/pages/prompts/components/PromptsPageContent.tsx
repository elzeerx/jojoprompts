
import { useState } from "react";
import { PromptsHeader } from "../PromptsHeader";
import { PromptsFilters } from "../PromptsFilters";
import { PromptsContent } from "../PromptsContent";
import { type Prompt } from "@/types";

interface PromptsPageContentProps {
  prompts: Prompt[];
  categories: string[];
  isLoading: boolean;
  error: string | null;
  reloadPrompts: () => Promise<void>;
}

export function PromptsPageContent({
  prompts, categories, isLoading, error, reloadPrompts
}: PromptsPageContentProps) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [promptType, setPromptType] = useState<"all" | "text" | "image">("all");
  const [category, setCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);

  const filteredPrompts = prompts.filter(prompt => {
    // Filter by type
    if (promptType !== "all" && prompt.prompt_type !== promptType) {
      return false;
    }
    
    // Filter by category
    if (category !== "all" && !prompt.categories?.includes(category)) {
      return false;
    }
    
    // Filter by search query
    if (searchQuery && !prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !prompt.prompt_text.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  return (
    <div className="container py-8 lg:py-12">
      <PromptsHeader
        view={view}
        setView={setView}
        selectedPromptsLength={selectedPrompts.length}
        onClearSelections={() => setSelectedPrompts([])}
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
        selectedPrompts={selectedPrompts}
        onSelectPrompt={(id) => {
          if (selectedPrompts.includes(id)) {
            setSelectedPrompts(selectedPrompts.filter(p => p !== id));
          } else {
            setSelectedPrompts([...selectedPrompts, id]);
          }
        }}
      />
    </div>
  );
}

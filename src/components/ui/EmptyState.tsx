import React from "react";
import { getCategoryTheme } from "@/components/ui/prompt-card/utils/categoryUtils";
import { Button } from "@/components/ui/button";
import { SearchX, Plus } from "lucide-react";

interface EmptyStateProps {
  category?: string;
  hasFilters?: boolean;
  onClearFilters?: () => void;
  onAddPrompt?: () => void;
  isAdmin?: boolean;
}

export function EmptyState({ 
  category = "All", 
  hasFilters = false, 
  onClearFilters, 
  onAddPrompt,
  isAdmin = false 
}: EmptyStateProps) {
  const theme = getCategoryTheme(category);
  const IconComponent = theme.icon;

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="mb-6">
          <SearchX className="h-16 w-16 text-muted-foreground/50 mx-auto" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          No prompts found
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md">
          We couldn't find any prompts matching your current filters. Try adjusting your search criteria.
        </p>
        <Button onClick={onClearFilters} variant="outline">
          Clear Filters
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div 
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
        style={{ backgroundColor: theme.color }}
      >
        <IconComponent className="h-10 w-10 text-white" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">
        No {category === "All" ? "" : category} prompts yet
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        {category === "All" 
          ? "Be the first to add a prompt to our collection!"
          : `Be the first to add a ${category.toLowerCase()} prompt!`
        }
      </p>
      {isAdmin && (
        <Button onClick={onAddPrompt} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Add First Prompt
        </Button>
      )}
    </div>
  );
}

import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { List, Grid, Search } from "lucide-react";

interface PromptsFiltersProps {
  category: string;
  setCategory: (cat: string) => void;
  categories: string[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  view: "grid" | "list";
  setView: (v: "grid" | "list") => void;
}

export function PromptsFilters({
  category, setCategory, categories, searchQuery, setSearchQuery, view, setView
}: PromptsFiltersProps) {
  const isGridView = view === "grid";
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-8">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search prompts..."
          className="pl-8"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat === "all" ? "All Categories" : cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setView(isGridView ? "list" : "grid")}
        >
          {isGridView ? (
            <List className="h-4 w-4" />
          ) : (
            <Grid className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

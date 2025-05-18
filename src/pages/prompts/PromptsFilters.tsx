
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
    <div className="flex flex-col sm:flex-row gap-4 mb-10 border-y border-white/10 py-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search prompts..."
          className="pl-10 rounded-full backdrop-blur-sm bg-white/10 border-white/10 font-medium"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>
      <div className="flex gap-3 items-center">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[170px] rounded-full backdrop-blur-sm bg-white/10 border-white/10">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="rounded-xl backdrop-blur-md bg-white/20 border border-white/20">
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat} className="rounded-lg">
                {cat === "all" ? "All Categories" : cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full backdrop-blur-sm bg-white/10 border-white/10 hover:bg-white/20"
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

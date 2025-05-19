
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { List, Grid, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const categoryOptions = ["all", "ChatGPT", "Midjourney", "n8n", "Arabic", "English", ...categories.filter(cat => 
    cat !== "all" && 
    !["ChatGPT", "Midjourney", "n8n", "Arabic", "English"].includes(cat)
  )];

  return (
    <div className="mb-10">
      {/* Category Tabs */}
      <div className="overflow-x-auto pb-3 mb-4 border-b border-warm-gold/10">
        <Tabs value={category} onValueChange={setCategory} className="w-full">
          <TabsList className="bg-transparent h-auto p-0 flex w-full justify-start space-x-4">
            {categoryOptions.map((cat) => (
              <TabsTrigger 
                key={cat} 
                value={cat}
                className="data-[state=active]:bg-warm-gold/10 data-[state=active]:text-warm-gold px-4 py-2 text-dark-base"
              >
                {cat === "all" ? "All Categories" : cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Search and View Options */}
      <div className="flex flex-col sm:flex-row gap-4 py-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search prompts..."
            className="pl-8 border-warm-gold/20"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3 items-center">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[170px] border-warm-gold/20">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat === "all" ? "All Categories" : cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="border-warm-gold/20"
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
    </div>
  );
}

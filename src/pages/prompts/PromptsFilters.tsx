
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { List, Grid, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCategories } from "@/hooks/useCategories";
import { useIsMobile } from '@/hooks/use-mobile';

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
  const { categories: dbCategories } = useCategories();
  const isMobile = useIsMobile();
  const isGridView = view === "grid";
  
  // Get active categories from database, fallback to passed categories
  const activeCategories = dbCategories.filter(cat => cat.is_active);
  const mainCategories = ["all", ...activeCategories.map(cat => cat.name)];
  
  // Filter out main categories from the full categories list to get subcategories
  const subCategories = categories.filter(cat => 
    cat !== "all" && 
    !mainCategories.includes(cat)
  );
  
  // Combine categories for the dropdown
  const categoryOptions = [
    ...mainCategories,
    ...subCategories
  ];

  return (
    <div className="mb-6 sm:mb-10 space-y-4 sm:space-y-6">
      {/* Category Tabs - Mobile optimized horizontal scroll */}
      <div className="overflow-x-auto pb-2 sm:pb-3 mb-3 sm:mb-4 border-b border-warm-gold/10">
        <Tabs value={category} onValueChange={setCategory} className="w-full">
          <TabsList className="mobile-tabs bg-gray-100/80 h-auto p-1 flex w-max min-w-full">
            {mainCategories.map((cat) => (
              <TabsTrigger 
                key={cat} 
                value={cat}
                className="mobile-tab mobile-tab-inactive data-[state=active]:mobile-tab-active whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 touch-manipulation"
              >
                {cat === "all" ? "All Categories" : cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Search and View Options - Mobile optimized */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:gap-4 py-2 sm:py-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <Input
            type="search"
            placeholder={isMobile ? "Search..." : "Search prompts..."}
            className="mobile-input pl-9 border-warm-gold/20 rounded-lg focus:ring-warm-gold"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            // Mobile keyboard optimization
            inputMode="search"
            autoComplete="off"
          />
        </div>
        <div className="flex gap-2 sm:gap-3 items-center">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mobile-select w-full sm:w-[170px] border-warm-gold/20 rounded-lg min-h-[44px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-white border border-warm-gold/20 shadow-lg rounded-lg z-50">
              {categoryOptions.map((cat) => (
                <SelectItem 
                  key={cat} 
                  value={cat}
                  className="touch-manipulation py-2 sm:py-2.5 px-3 sm:px-4 hover:bg-warm-gold/10 transition-colors"
                >
                  {cat === "all" ? "All Categories" : cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="border-warm-gold/20 rounded-lg touch-friendly hover:bg-warm-gold/10 transition-colors"
            onClick={() => setView(isGridView ? "list" : "grid")}
          >
            {isGridView ? (
              <List className="mobile-icon" />
            ) : (
              <Grid className="mobile-icon" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

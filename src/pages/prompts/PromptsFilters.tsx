
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { List, Grid, Search, Sparkles, Bot, Wand2, Video, Mic, Music } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCategories } from "@/hooks/useCategories";
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

// AI Platform options for filtering
const AI_PLATFORMS = [
  { value: 'all', label: 'All Platforms', icon: null },
  { value: 'chatgpt-text', label: 'ChatGPT', icon: Bot },
  { value: 'chatgpt-gpt-builder', label: 'GPTs Builder', icon: Bot },
  { value: 'claude-text', label: 'Claude', icon: Bot },
  { value: 'gemini-image', label: 'Gemini', icon: Sparkles },
  { value: 'midjourney-full', label: 'Midjourney', icon: Wand2 },
  { value: 'flux-image', label: 'Flux', icon: Wand2 },
  { value: 'sora-video', label: 'Sora', icon: Video },
  { value: 'elevenlabs-voice', label: 'ElevenLabs', icon: Mic },
  { value: 'suno-music', label: 'Suno', icon: Music },
  { value: 'workflow-n8n', label: 'n8n Workflow', icon: null },
];

interface PromptsFiltersProps {
  category: string;
  setCategory: (cat: string) => void;
  categories: string[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  view: "grid" | "list";
  setView: (v: "grid" | "list") => void;
  modelType?: string;
  setModelType?: (type: string) => void;
}

export function PromptsFilters({
  category, setCategory, categories, searchQuery, setSearchQuery, view, setView,
  modelType = 'all', setModelType
}: PromptsFiltersProps) {
  const { t, isRTL } = useTranslation();
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
      <div className={cn(
        "overflow-x-auto pb-2 sm:pb-3 mb-3 sm:mb-4 border-b border-warm-gold/10",
        isRTL && "direction-rtl"
      )}>
        <Tabs value={category} onValueChange={setCategory} className="w-full">
          <TabsList className="mobile-tabs bg-gray-100/80 h-auto p-1 flex w-max min-w-full">
            {mainCategories.map((cat) => (
              <TabsTrigger 
                key={cat} 
                value={cat}
                className="mobile-tab mobile-tab-inactive data-[state=active]:mobile-tab-active whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 touch-manipulation"
              >
                {cat === "all" ? t("prompts.allCategories") : cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Search and View Options - Mobile optimized */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:gap-4 py-2 sm:py-3">
        <div className="relative flex-1">
          <Search className={cn(
            "absolute top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10",
            isRTL ? "right-2.5" : "left-2.5"
          )} />
          <Input
            type="search"
            placeholder={isMobile ? t("prompts.searchPlaceholderMobile") : t("prompts.searchPlaceholder")}
            className={cn(
              "mobile-input border-warm-gold/20 rounded-lg focus:ring-warm-gold",
              isRTL ? "pr-9" : "pl-9"
            )}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            // Mobile keyboard optimization
            inputMode="search"
            autoComplete="off"
          />
        </div>
        <div className={cn(
          "flex gap-2 sm:gap-3 items-center flex-wrap",
          isRTL && "flex-row-reverse"
        )}>
          {/* AI Platform Filter */}
          {setModelType && (
            <Select value={modelType} onValueChange={setModelType}>
              <SelectTrigger className="mobile-select w-full sm:w-[150px] border-warm-gold/20 rounded-lg min-h-[44px]">
                <SelectValue placeholder="AI Platform" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-warm-gold/20 shadow-lg rounded-lg z-50 max-h-[300px]">
                {AI_PLATFORMS.map((platform) => {
                  const IconComponent = platform.icon;
                  return (
                    <SelectItem 
                      key={platform.value} 
                      value={platform.value}
                      className="touch-manipulation py-2 sm:py-2.5 px-3 sm:px-4 hover:bg-warm-gold/10 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        {IconComponent && <IconComponent className="h-4 w-4" />}
                        {platform.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          
          {/* Category Filter */}
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mobile-select w-full sm:w-[170px] border-warm-gold/20 rounded-lg min-h-[44px]">
              <SelectValue placeholder={t("prompts.categoryPlaceholder")} />
            </SelectTrigger>
            <SelectContent className="bg-white border border-warm-gold/20 shadow-lg rounded-lg z-50">
              {categoryOptions.map((cat) => (
                <SelectItem 
                  key={cat} 
                  value={cat}
                  className="touch-manipulation py-2 sm:py-2.5 px-3 sm:px-4 hover:bg-warm-gold/10 transition-colors"
                >
                  {cat === "all" ? t("prompts.allCategories") : cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="border-warm-gold/20 rounded-lg touch-friendly hover:bg-warm-gold/10 transition-colors"
            onClick={() => setView(isGridView ? "list" : "grid")}
            aria-label={isGridView ? t("prompts.listView") : t("prompts.gridView")}
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


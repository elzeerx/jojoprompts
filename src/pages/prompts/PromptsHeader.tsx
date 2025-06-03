
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Grid, List, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from '@/hooks/use-mobile';

interface PromptsHeaderProps {
  view: "grid" | "list";
  setView: (v: "grid" | "list") => void;
  selectedPromptsLength: number;
  onClearSelections: () => void;
  promptType: "image" | "text" | "all";
  setPromptType: (type: "image" | "text" | "all") => void;
}

export function PromptsHeader({
  view, setView, promptType, setPromptType
}: PromptsHeaderProps) {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col space-y-4 sm:space-y-6 md:flex-row md:items-end md:justify-between md:space-y-0 mb-6 sm:mb-8 mobile-container-padding sm:px-0">
      <div className="space-y-2 sm:space-y-3 text-center md:text-left">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-dark-base">
          Premium Prompts
        </h1>
        <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-2xl">
          Discover and use high-quality prompts for AI image generation and text assistance
        </p>
      </div>
      
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5">
        {/* Mobile-first prompt type tabs */}
        <div className="w-full sm:w-auto">
          <Tabs value={promptType} onValueChange={(v: any) => setPromptType(v)} className="w-full">
            <TabsList className="mobile-tabs w-full sm:w-auto border border-warm-gold/20 bg-gray-100/80">
              <TabsTrigger 
                value="all" 
                className="mobile-tab mobile-tab-inactive data-[state=active]:mobile-tab-active flex-1 sm:flex-initial font-medium text-xs sm:text-sm"
              >
                All
              </TabsTrigger>
              <TabsTrigger 
                value="text" 
                className="mobile-tab mobile-tab-inactive data-[state=active]:mobile-tab-active flex-1 sm:flex-initial font-medium text-xs sm:text-sm"
              >
                Text
              </TabsTrigger>
              <TabsTrigger 
                value="image" 
                className="mobile-tab mobile-tab-inactive data-[state=active]:mobile-tab-active flex-1 sm:flex-initial font-medium text-xs sm:text-sm"
              >
                Image
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* View options dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size={isMobile ? "default" : "sm"}
              className="touch-friendly border-warm-gold/20 hover:bg-warm-gold/10 transition-colors w-full sm:w-auto"
            >
              <SlidersHorizontal className="mobile-icon mr-2" />
              <span className="font-medium">{isMobile ? 'View' : 'View Options'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="bg-white border border-warm-gold/20 shadow-lg rounded-lg z-50 w-40"
          >
            <DropdownMenuItem 
              onClick={() => setView("grid")}
              className="touch-manipulation py-2.5 px-4 hover:bg-warm-gold/10 transition-colors cursor-pointer"
            >
              <Grid className="mobile-icon mr-2" />
              Grid View
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setView("list")}
              className="touch-manipulation py-2.5 px-4 hover:bg-warm-gold/10 transition-colors cursor-pointer"
            >
              <List className="mobile-icon mr-2" />
              List View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}


import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Grid, List, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  return (
    <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-gradient">Browse Prompts</h1>
        <p className="text-muted-foreground mt-2">
          Discover and use high-quality prompts for AI image generation and text assistance
        </p>
      </div>
      <div className="flex items-center gap-5">
        <Tabs value={promptType} onValueChange={(v: any) => setPromptType(v)} className="hidden sm:block">
          <TabsList className="backdrop-blur-sm bg-white/20 border border-white/10 rounded-full">
            <TabsTrigger value="all" className="font-medium rounded-full data-[state=active]:bg-primary/90 data-[state=active]:text-white">All</TabsTrigger>
            <TabsTrigger value="text" className="font-medium rounded-full data-[state=active]:bg-primary/90 data-[state=active]:text-white">Text</TabsTrigger>
            <TabsTrigger value="image" className="font-medium rounded-full data-[state=active]:bg-primary/90 data-[state=active]:text-white">Image</TabsTrigger>
          </TabsList>
        </Tabs>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto flex gap-2 rounded-full backdrop-blur-sm bg-white/20 border-white/10 hover:bg-white/30">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">View</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl backdrop-blur-md bg-white/20 border border-white/20">
            <DropdownMenuItem onClick={() => setView("grid")} className="rounded-lg hover:bg-white/10">
              <Grid className="h-4 w-4 mr-2" />
              Grid View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("list")} className="rounded-lg hover:bg-white/10">
              <List className="h-4 w-4 mr-2" />
              List View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

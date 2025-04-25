
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
    <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Browse Prompts</h1>
        <p className="text-muted-foreground">
          Discover and use high-quality prompts for AI image generation and text assistance
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Tabs value={promptType} onValueChange={(v: any) => setPromptType(v)} className="hidden sm:block">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="image">Image</TabsTrigger>
          </TabsList>
        </Tabs>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto flex gap-1">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">View</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setView("grid")}>
              <Grid className="h-4 w-4 mr-2" />
              Grid View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("list")}>
              <List className="h-4 w-4 mr-2" />
              List View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

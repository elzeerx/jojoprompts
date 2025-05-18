
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
        <h1 className="text-4xl font-extrabold tracking-tight">Browse Prompts</h1>
        <p className="text-muted-foreground font-mono mt-2">
          Discover and use high-quality prompts for AI image generation and text assistance
        </p>
      </div>
      <div className="flex items-center gap-5">
        <Tabs value={promptType} onValueChange={(v: any) => setPromptType(v)} className="hidden sm:block">
          <TabsList className="rounded-none border border-border">
            <TabsTrigger value="all" className="font-medium rounded-none">All</TabsTrigger>
            <TabsTrigger value="text" className="font-medium rounded-none">Text</TabsTrigger>
            <TabsTrigger value="image" className="font-medium rounded-none">Image</TabsTrigger>
          </TabsList>
        </Tabs>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto flex gap-2 rounded-none">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">View</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-none">
            <DropdownMenuItem onClick={() => setView("grid")} className="font-mono">
              <Grid className="h-4 w-4 mr-2" />
              Grid View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("list")} className="font-mono">
              <List className="h-4 w-4 mr-2" />
              List View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

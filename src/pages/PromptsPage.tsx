
import { useState, useEffect } from "react";
import { PromptCard } from "@/components/ui/prompt-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Grid, List, Search, SlidersHorizontal } from "lucide-react";
import { type Prompt, type PromptRow } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export default function PromptsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchPrompts = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("prompts")
          .select("*")
          .order("created_at", { ascending: false })
          .returns<PromptRow[]>();
        
        if (error) throw error;
        
        // Transform data to match our Prompt type
        const transformedData = data?.map(item => ({
          id: item.id,
          user_id: item.user_id,
          title: item.title,
          prompt_text: item.prompt_text,
          image_url: item.image_url,
          created_at: item.created_at || "",
          metadata: {
            category: item.metadata?.category || undefined,
            style: item.metadata?.style || undefined,
            tags: Array.isArray(item.metadata?.tags) ? item.metadata?.tags : []
          }
        })) || [];
        
        setPrompts(transformedData);
        
        // Extract unique categories for filtering
        const uniqueCategories = [...new Set(transformedData
          .map(p => p.metadata?.category)
          .filter(Boolean) as string[]
        )];
        
        setCategories(["all", ...uniqueCategories]);
      } catch (error) {
        console.error("Error fetching prompts:", error);
        toast({
          title: "Error",
          description: "Failed to load prompts. Please try again later.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPrompts();
  }, []);
  
  const isGridView = view === "grid";
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  const handleSelectPrompt = (promptId: string) => {
    setSelectedPrompts(prev => 
      prev.includes(promptId)
        ? prev.filter(id => id !== promptId)
        : [...prev, promptId]
    );
  };
  
  const handleSelectAll = () => {
    if (selectedPrompts.length === filteredPrompts.length) {
      setSelectedPrompts([]);
    } else {
      setSelectedPrompts(filteredPrompts.map(p => p.id));
    }
  };
  
  const handleExportPDF = async () => {
    try {
      const promptsToExport = filteredPrompts.filter(p => selectedPrompts.includes(p.id));
      const { downloadPromptsPDF } = await import('@/utils/pdf-export');
      await downloadPromptsPDF(promptsToExport);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Error", 
        description: "Failed to create PDF. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = searchQuery === "" || 
      prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.prompt_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.metadata.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = category === "all" || prompt.metadata.category === category;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container py-8">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Browse Prompts</h1>
          <p className="text-muted-foreground">
            Discover and use high-quality AI image generation prompts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedPrompts.length > 0 ? (
            <>
              <Button size="sm" onClick={() => setSelectedPrompts([])}>
                Clear ({selectedPrompts.length})
              </Button>
              <Button 
                size="sm" 
                variant="default" 
                onClick={handleExportPDF}
                className="flex items-center gap-1"
              >
                <Download className="h-4 w-4" /> Export PDF
              </Button>
            </>
          ) : (
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
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search prompts..."
            className="pl-8"
            value={searchQuery}
            onChange={handleSearch}
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

      {selectedPrompts.length > 0 && (
        <div className="flex items-center justify-between p-3 mb-4 bg-secondary rounded-md">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedPrompts.length === filteredPrompts.length ? "Deselect All" : "Select All"}
            </Button>
            <span className="text-sm text-muted-foreground">
              {selectedPrompts.length} {selectedPrompts.length === 1 ? "prompt" : "prompts"} selected
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleExportPDF}
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" /> Export as PDF
          </Button>
        </div>
      )}

      {filteredPrompts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">No prompts found matching your search.</p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery("");
              setCategory("all");
            }}
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className={isGridView 
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" 
          : "flex flex-col gap-3"
        }>
          {filteredPrompts.map((prompt) => (
            <PromptCard 
              key={prompt.id}
              prompt={prompt}
              isSelectable={true}
              isSelected={selectedPrompts.includes(prompt.id)}
              onSelect={handleSelectPrompt}
            />
          ))}
        </div>
      )}
    </div>
  );
}

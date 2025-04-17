
import { useState } from "react";
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
import { Download, Grid, List, Search, Filter, SlidersHorizontal } from "lucide-react";
import { type Prompt } from "@/types";

// Temporary mock data - will be replaced with Supabase data
const mockPrompts: Prompt[] = [
  {
    id: "1",
    user_id: "admin-user",
    title: "Cyberpunk City Night",
    prompt_text: "A futuristic cyberpunk city at night, with neon signs, flying cars, and holographic billboards. The scene is illuminated by a mix of purple and blue lights reflecting on wet streets.",
    image_url: "https://images.unsplash.com/photo-1559650656-5d1d361ad10e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&h=600&q=80",
    metadata: {
      category: "Environments",
      style: "Cyberpunk",
      tags: ["neon", "futuristic", "cityscape", "night", "scifi"]
    },
    created_at: "2023-06-15T10:00:00Z"
  },
  {
    id: "2",
    user_id: "admin-user",
    title: "Fantasy Forest Portal",
    prompt_text: "A magical portal in the middle of an ancient forest. Glowing mushrooms and plants surround the swirling energy gate. Magical particles float in the air, and ethereal creatures peek from behind trees.",
    image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&h=600&q=80",
    metadata: {
      category: "Fantasy",
      style: "Magical Realism",
      tags: ["forest", "portal", "magic", "fantasy", "ethereal"]
    },
    created_at: "2023-06-16T11:30:00Z"
  },
  {
    id: "3",
    user_id: "admin-user",
    title: "Astronaut on Alien Planet",
    prompt_text: "An astronaut standing on a vibrant alien planet with impossible floating rock formations. Two moons visible in the purple sky. Strange plant life and crystalline structures dot the landscape.",
    image_url: null,
    metadata: {
      category: "Sci-Fi",
      style: "Space Exploration",
      tags: ["astronaut", "alien", "space", "exploration", "planets"]
    },
    created_at: "2023-06-17T09:15:00Z"
  },
  {
    id: "4",
    user_id: "admin-user",
    title: "Steampunk Airship Battle",
    prompt_text: "Epic battle between steampunk airships in a cloudy sky. Brass, copper, and wooden ships with giant propellers and billowing steam, exchanging cannon fire. Sunset colors the clouds in orange and gold.",
    image_url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&h=600&q=80",
    metadata: {
      category: "Action",
      style: "Steampunk",
      tags: ["airship", "battle", "steampunk", "clouds", "fantasy"]
    },
    created_at: "2023-06-18T14:45:00Z"
  },
  {
    id: "5",
    user_id: "admin-user",
    title: "Underwater Ancient Ruins",
    prompt_text: "Submerged ancient ruins of a forgotten civilization deep under the ocean. Ornate stone architecture covered in coral and seaweed. Shafts of light penetrate the water surface, illuminating the scene.",
    image_url: null,
    metadata: {
      category: "Environments",
      style: "Underwater",
      tags: ["underwater", "ruins", "ancient", "ocean", "mysterious"]
    },
    created_at: "2023-06-19T16:20:00Z"
  },
  {
    id: "6",
    user_id: "admin-user",
    title: "Dragon's Mountain Lair",
    prompt_text: "A majestic dragon perched on a mountain peak. Its scales shimmer with iridescent colors. The landscape shows a vast fantasy kingdom below with tiny castles and villages. Clouds surround the mountain.",
    image_url: "https://images.unsplash.com/photo-1506466010722-395aa2bef877?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&h=600&q=80",
    metadata: {
      category: "Fantasy",
      style: "Dragons",
      tags: ["dragon", "mountain", "fantasy", "creature", "landscape"]
    },
    created_at: "2023-06-20T08:10:00Z"
  }
];

export default function PromptsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("all");
  
  // View options
  const isGridView = view === "grid";
  
  // Handlers
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
      // Import dynamically to avoid loading jsPDF unnecessarily
      const { downloadPromptsPDF } = await import('@/utils/pdf-export');
      await downloadPromptsPDF(promptsToExport);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('There was an error creating the PDF. Please try again.');
    }
  };
  
  // Filtering logic
  const filteredPrompts = mockPrompts.filter(prompt => {
    const matchesSearch = searchQuery === "" || 
      prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.prompt_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.metadata.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = category === "all" || prompt.metadata.category === category;
    
    return matchesSearch && matchesCategory;
  });
  
  // Extract unique categories for filter
  const categories = ["all", ...new Set(mockPrompts.map(p => p.metadata.category || ""))];
  
  return (
    <div className="container py-8">
      {/* Header */}
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

      {/* Filters */}
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

      {/* Selection bar */}
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

      {/* Prompts Grid/List */}
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

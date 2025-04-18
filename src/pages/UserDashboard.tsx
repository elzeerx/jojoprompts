
import { Button } from "@/components/ui/button";
import { PromptCard } from "@/components/ui/prompt-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText } from "lucide-react";
import { useState } from "react";
import { type Prompt } from "@/types";

// Temporary mock data - will be replaced with Supabase data
const mockFavorites: Prompt[] = [
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
  }
];

const mockRecent: Prompt[] = [
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
  }
];

export default function DashboardPage() {
  const [selectedTab, setSelectedTab] = useState("favorites");
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
  
  const handleExportPDF = async () => {
    try {
      const promptsToExport = currentPrompts.filter(p => selectedPrompts.includes(p.id));
      // Import dynamically to avoid loading jsPDF unnecessarily
      const { downloadPromptsPDF } = await import('@/utils/pdf-export');
      await downloadPromptsPDF(promptsToExport);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('There was an error creating the PDF. Please try again.');
    }
  };
  
  const handleSelectPrompt = (promptId: string) => {
    setSelectedPrompts(prev => 
      prev.includes(promptId)
        ? prev.filter(id => id !== promptId)
        : [...prev, promptId]
    );
  };
  
  const currentPrompts = selectedTab === "favorites" ? mockFavorites : mockRecent;
  
  return (
    <div className="container py-8">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your favorite prompts and recent activity
          </p>
        </div>
        
        {selectedPrompts.length > 0 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelectedPrompts([])}>
              Clear ({selectedPrompts.length})
            </Button>
            <Button 
              size="sm" 
              onClick={handleExportPDF}
              className="flex items-center gap-1"
            >
              <Download className="h-4 w-4" /> Export PDF
            </Button>
          </div>
        )}
      </div>
      
      <Tabs defaultValue="favorites" value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="recent">Recently Viewed</TabsTrigger>
        </TabsList>
        
        <TabsContent value="favorites">
          {mockFavorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No favorites yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                You haven't added any prompts to your favorites. Browse and save the ones you like!
              </p>
              <Button asChild>
                <a href="/prompts">Browse Prompts</a>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockFavorites.map((prompt) => (
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
        </TabsContent>
        
        <TabsContent value="recent">
          {mockRecent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No recent activity</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                You haven't viewed any prompts recently. Start exploring!
              </p>
              <Button asChild>
                <a href="/prompts">Browse Prompts</a>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockRecent.map((prompt) => (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

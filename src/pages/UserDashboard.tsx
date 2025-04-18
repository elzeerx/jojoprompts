
import { Button } from "@/components/ui/button";
import { PromptCard } from "@/components/ui/prompt-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { type Prompt } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const [selectedTab, setSelectedTab] = useState("favorites");
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Prompt[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchUserPrompts = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        // In a real app, you'd have favorites and recently viewed tables
        // For now, we'll just fetch all prompts and split them
        const { data, error } = await supabase
          .from("prompts")
          .select("*")
          .order("created_at", { ascending: false });
          
        if (error) throw error;
        
        // Transform data to match Prompt type
        const transformedData = data?.map(item => ({
          id: item.id,
          user_id: item.user_id,
          title: item.title,
          prompt_text: item.prompt_text,
          image_url: item.image_url,
          created_at: item.created_at || "",
          metadata: typeof item.metadata === 'object' ? 
            {
              category: item.metadata?.category as string || undefined,
              style: item.metadata?.style as string || undefined,
              tags: Array.isArray(item.metadata?.tags) ? item.metadata?.tags as string[] : []
            } : { category: undefined, style: undefined, tags: [] }
        })) || [];
        
        // For demo purposes, split the data to simulate favorites and recently viewed
        // In a real app, these would come from different queries
        setFavorites(transformedData.slice(0, 2));
        setRecentlyViewed(transformedData.slice(2, 4));
      } catch (error) {
        console.error("Error fetching user prompts:", error);
        toast({
          title: "Error",
          description: "Failed to load prompts. Please try again later.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserPrompts();
  }, [user]);
  
  const handleExportPDF = async () => {
    try {
      const promptsToExport = currentPrompts.filter(p => selectedPrompts.includes(p.id));
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
  
  const handleSelectPrompt = (promptId: string) => {
    setSelectedPrompts(prev => 
      prev.includes(promptId)
        ? prev.filter(id => id !== promptId)
        : [...prev, promptId]
    );
  };
  
  const currentPrompts = selectedTab === "favorites" ? favorites : recentlyViewed;
  
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
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : favorites.length === 0 ? (
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
              {favorites.map((prompt) => (
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
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : recentlyViewed.length === 0 ? (
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
              {recentlyViewed.map((prompt) => (
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

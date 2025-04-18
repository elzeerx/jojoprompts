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
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    let mounted = true;

    const fetchFavorites = async () => {
      if (authLoading || !user) return;

      setIsLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("favorites")
          .select("prompt:prompts(*)")
          .eq("user_id", user.id);

        if (error) throw error;
        if (!mounted) return;

        const transformedData = data?.map(item => {
          const promptData = item.prompt as any;
          return {
            id: promptData.id,
            user_id: promptData.user_id,
            title: promptData.title,
            prompt_text: promptData.prompt_text,
            image_path: promptData.image_url,
            created_at: promptData.created_at || "",
            metadata: {
              category: promptData.metadata?.category || undefined,
              style: promptData.metadata?.style || undefined,
              tags: Array.isArray(promptData.metadata?.tags) ? promptData.metadata?.tags : []
            }
          } as Prompt;
        }) || [];

        setFavorites(transformedData);
      } catch (error: any) {
        console.error("Error fetching favorites:", error);
        if (mounted) {
          setError("Failed to load favorites");
          toast({
            title: "Error",
            description: "Failed to load favorites. Please try again later.",
            variant: "destructive"
          });
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchFavorites();

    return () => {
      mounted = false;
    };
  }, [user, authLoading]);

  const handleExportPDF = async () => {
    try {
      const promptsToExport = favorites.filter(p => selectedPrompts.includes(p.id));
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

  const renderContent = () => {
    if (authLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-2">Checking authentication...</p>
          <div className="h-1 w-64 bg-secondary overflow-hidden rounded-full">
            <div className="h-full bg-primary animate-pulse rounded-full"></div>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-2">Loading your favorites...</p>
          <div className="h-1 w-64 bg-secondary overflow-hidden rounded-full">
            <div className="h-full bg-primary animate-pulse rounded-full"></div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      );
    }

    if (favorites.length === 0) {
      return (
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
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {favorites.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            isSelectable={true}
            isSelected={selectedPrompts.includes(prompt.id)}
            onSelect={handleSelectPrompt}
            initiallyFavorited={true}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="container py-8">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your favorite prompts
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

      <Tabs defaultValue="favorites">
        <TabsList className="mb-6">
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
        </TabsList>

        <TabsContent value="favorites">
          {renderContent()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

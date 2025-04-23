
import { Button } from "@/components/ui/button";
import { PromptCard } from "@/components/ui/prompt-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { type Prompt } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export default function FavoritesPage() {
  const [selectedFavoritePrompts, setSelectedFavoritePrompts] = useState<string[]>([]);
  const [favoritePrompts, setFavoritePrompts] = useState<Prompt[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    let mounted = true;

    const loadFavoritePrompts = async () => {
      if (authLoading || !user) return;

      setIsLoadingFavorites(true);
      setLoadError(null);

      try {
        const { data, error } = await supabase
          .from("favorites")
          .select("prompt:prompts(*)")
          .eq("user_id", user.id);

        if (error) throw error;
        if (!mounted) return;

        const transformedPrompts = data?.map(item => {
          const promptData = item.prompt as any;
          return {
            id: promptData.id,
            user_id: promptData.user_id,
            title: promptData.title,
            prompt_text: promptData.prompt_text,
            image_path: promptData.image_path,
            created_at: promptData.created_at || "",
            metadata: {
              category: promptData.metadata?.category || undefined,
              style: promptData.metadata?.style || undefined,
              tags: Array.isArray(promptData.metadata?.tags) ? promptData.metadata?.tags : []
            }
          } as Prompt;
        }) || [];

        setFavoritePrompts(transformedPrompts);
      } catch (error: any) {
        console.error("Error loading favorites:", error);
        if (mounted) {
          setLoadError("Failed to load favorite prompts");
          toast({
            title: "Error",
            description: "Failed to load your favorite prompts. Please try again later.",
            variant: "destructive"
          });
        }
      } finally {
        if (mounted) {
          setIsLoadingFavorites(false);
        }
      }
    };

    loadFavoritePrompts();

    return () => {
      mounted = false;
    };
  }, [user, authLoading]);

  const handleSelectFavorite = (promptId: string) => {
    setSelectedFavoritePrompts(prev =>
      prev.includes(promptId)
        ? prev.filter(id => id !== promptId)
        : [...prev, promptId]
    );
  };

  const renderFavoritesContent = () => {
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

    if (isLoadingFavorites) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-2">Loading your favorite prompts...</p>
          <div className="h-1 w-64 bg-secondary overflow-hidden rounded-full">
            <div className="h-full bg-primary animate-pulse rounded-full"></div>
          </div>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive mb-4">{loadError}</p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      );
    }

    if (favoritePrompts.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-primary/10 p-3 mb-4">
            <Heart className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No favorite prompts yet</h3>
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
        {favoritePrompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            isSelectable={true}
            isSelected={selectedFavoritePrompts.includes(prompt.id)}
            onSelect={handleSelectFavorite}
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
          <h1 className="text-3xl font-bold tracking-tight">My Favorites</h1>
          <p className="text-muted-foreground">
            Manage your favorite prompts
          </p>
        </div>

        {selectedFavoritePrompts.length > 0 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelectedFavoritePrompts([])}>
              Clear ({selectedFavoritePrompts.length})
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="favorites">
        <TabsList className="mb-6">
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
        </TabsList>

        <TabsContent value="favorites">
          {renderFavoritesContent()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

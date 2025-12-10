import { Button } from "@/components/ui/button";
import { ModernPromptCard } from "@/components/ui/modern-prompt-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { type PromptRow } from "@/types/prompts";
import { supabase } from "@/integrations/supabase/client";
import { usePromptAccess } from "@/hooks/usePromptAccess";
import { toast } from "@/hooks/use-toast";
import { SectionLoadingState, EmptyState, ErrorState } from "@/components/ui/loading-states";
import { createLogger } from '@/utils/logging';
import { useNavigate } from "react-router-dom";

const logger = createLogger('FAVORITES_PAGE');

export default function FavoritesPage() {
  const [selectedFavoritePrompts, setSelectedFavoritePrompts] = useState<string[]>([]);
  const [favoritePrompts, setFavoritePrompts] = useState<PromptRow[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { user, checkPromptAccess } = usePromptAccess();
  const navigate = useNavigate();
  const authLoading = false; // usePromptAccess handles auth state internally

  const handleUpgradeClick = () => {
    navigate('/pricing');
  };

  useEffect(() => {
    let mounted = true;

    const loadFavoritePrompts = async () => {
      if (authLoading || !user) return;

      setIsLoadingFavorites(true);
      setLoadError(null);

      try {
        const { data, error } = await supabase
          .from("favorites")
          .select(`
            prompt:prompts(
              *,
              profiles:user_id(
                first_name,
                last_name,
                username,
                avatar_url
              )
            )
          `)
          .eq("user_id", user.id);

        if (error) throw error;
        if (!mounted) return;

        const transformedPrompts: PromptRow[] = data?.map(item => {
          const promptData = item.prompt as any;
          const profile = promptData?.profiles;
          return {
            id: promptData.id,
            user_id: promptData.user_id,
            title: promptData.title,
            prompt_text: promptData.prompt_text,
            image_path: promptData.image_path,
            default_image_path: promptData.default_image_path,
            prompt_type: promptData.prompt_type,
            created_at: promptData.created_at || "",
            metadata: promptData.metadata || {},
            uploader_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : undefined,
            uploader_username: profile?.username,
            uploader_avatar_url: profile?.avatar_url
          };
        }) || [];

        setFavoritePrompts(transformedPrompts);
      } catch (error: any) {
        logger.error('Failed to load favorites', { error: error.message || error, userId: user?.id });
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
      return <SectionLoadingState message="Checking authentication..." />;
    }

    if (isLoadingFavorites) {
      return <SectionLoadingState message="Loading your favorite prompts..." />;
    }

    if (loadError) {
      return (
        <ErrorState 
          message={loadError}
          onRetry={() => window.location.reload()}
        />
      );
    }

    if (favoritePrompts.length === 0) {
      return (
        <EmptyState
          icon={<Heart className="h-6 w-6 text-warm-gold" />}
          title="No favorite prompts yet"
          description="You haven't added any prompts to your favorites. Browse and save the ones you like!"
          action={
            <Button asChild className="mobile-button-primary">
              <a href="/prompts">Browse Prompts</a>
            </Button>
          }
        />
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {favoritePrompts.map((prompt) => (
          <ModernPromptCard
            key={prompt.id}
            prompt={prompt}
            isSelectable={true}
            isSelected={selectedFavoritePrompts.includes(prompt.id)}
            onSelect={handleSelectFavorite}
            initiallyFavorited={true}
            isLocked={checkPromptAccess(prompt)}
            onUpgradeClick={handleUpgradeClick}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="mobile-container-padding pt-20 lg:pt-24 pb-8">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-dark-base">My Favorites</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your favorite prompts
          </p>
        </div>

        {selectedFavoritePrompts.length > 0 && (
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setSelectedFavoritePrompts([])}
              className="mobile-button-ghost text-xs sm:text-sm"
            >
              Clear ({selectedFavoritePrompts.length})
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="favorites">
        <TabsList className="mb-4 sm:mb-6 mobile-tabs">
          <TabsTrigger value="favorites" className="mobile-tab touch-target">Favorites</TabsTrigger>
        </TabsList>

        <TabsContent value="favorites">
          {renderFavoritesContent()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

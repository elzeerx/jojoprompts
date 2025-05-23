
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useFavoriteStatus(promptId: string, session: any) {
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    if (session) {
      const checkFavoriteStatus = async () => {
        const { data } = await supabase
          .from("favorites")
          .select()
          .eq("user_id", session.user.id)
          .eq("prompt_id", promptId);
        
        setFavorited(!!data && data.length > 0);
      };
      
      checkFavoriteStatus();
    }
  }, [promptId, session]);

  const handleToggleFavorite = async () => {
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please log in to favorite prompts",
        variant: "destructive"
      });
      return;
    }
    
    try {
      if (favorited) {
        await supabase.from("favorites").delete().eq("user_id", session.user.id).eq("prompt_id", promptId);
      } else {
        await supabase.from("favorites").insert({
          user_id: session.user.id,
          prompt_id: promptId
        });
      }
      setFavorited(!favorited);
      
      toast({
        title: favorited ? "Removed from favorites" : "Added to favorites",
        description: favorited ? "Prompt removed from your favorites" : "Prompt added to your favorites"
      });
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive"
      });
    }
  };

  return { favorited, handleToggleFavorite };
}

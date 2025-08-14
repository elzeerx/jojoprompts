
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Prompt, PromptRow } from "@/types";
import { handleAuthError, handleFavoriteError } from "@/utils/errorHandling";

export function useFavoriteLogic(prompt: Prompt | PromptRow, initiallyFavorited: boolean = false) {
  const { session } = useAuth();
  const [favorited, setFavorited] = useState<boolean>(initiallyFavorited);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session) {
      handleAuthError(null, "favorite_toggle");
      return;
    }
    try {
      if (favorited) {
        await supabase
          .from("favorites")
          .delete()
          .eq("user_id", session.user.id)
          .eq("prompt_id", prompt.id);
      } else {
        await supabase
          .from("favorites")
          .insert({ user_id: session.user.id, prompt_id: prompt.id });
      }
      setFavorited(!favorited);
    } catch (error) {
      handleFavoriteError(error, "favorite_toggle");
    }
  };

  return { favorited, toggleFavorite };
}


import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { type Prompt } from "@/types";
import { Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "./button";
import { getPromptImage, getTextPromptDefaultImage } from "@/utils/image";

interface MagazinePromptCardProps {
  prompt: Prompt;
  showImage?: boolean;
  colorIndex: number;
  bgColors: string[];
  onCardClick: () => void;
  className?: string;
}

export function MagazinePromptCard({
  prompt,
  showImage = true,
  colorIndex,
  bgColors,
  onCardClick,
  className
}: MagazinePromptCardProps) {
  const { title, prompt_text, metadata, prompt_type } = prompt;
  const tags = metadata?.tags || [];
  const category = metadata?.category || "General";
  const { session } = useAuth();
  const [favorited, setFavorited] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string>('/img/placeholder.png');
  const isTextPrompt = prompt_type === 'text';
  
  // Choose image path based on prompt type
  const imagePath = isTextPrompt
    ? prompt.default_image_path || 'textpromptdefaultimg.jpg'
    : prompt.image_path || prompt.image_url || null;

  useEffect(() => {
    async function loadImage() {
      try {
        const url = isTextPrompt && imagePath === 'textpromptdefaultimg.jpg'
          ? await getTextPromptDefaultImage()
          : await getPromptImage(imagePath, 400, 90);
        
        setImageUrl(url);
      } catch (error) {
        console.error('Error loading prompt image:', error);
        setImageUrl('/img/placeholder.png');
      }
    }
    loadImage();
    
    // Check if prompt is favorited by current user
    if (session) {
      const checkFavoriteStatus = async () => {
        const { data } = await supabase
          .from("favorites")
          .select()
          .eq("user_id", session.user.id)
          .eq("prompt_id", prompt.id);
        
        setFavorited(!!data && data.length > 0);
      };
      
      checkFavoriteStatus();
    }
  }, [imagePath, isTextPrompt, prompt.id, session]);
  
  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
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
        await supabase.from("favorites").delete().eq("user_id", session.user.id).eq("prompt_id", prompt.id);
      } else {
        await supabase.from("favorites").insert({
          user_id: session.user.id,
          prompt_id: prompt.id
        });
      }
      setFavorited(!favorited);
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive"
      });
    }
  };

  // Get category badge color
  const getCategoryColor = (type: string) => {
    switch(type.toLowerCase()) {
      case 'midjourney':
        return 'bg-warm-gold text-white';
      case 'chatgpt':
        return 'bg-warm-gold text-white';
      default:
        return 'bg-warm-gold text-white';
    }
  };

  return (
    <div 
      className={cn(
        "group cursor-pointer overflow-hidden bg-white",
        "h-full transition-all duration-300 hover:shadow-xl",
        "rounded-xl border border-gray-200 hover:border-warm-gold/30",
        className
      )}
      onClick={onCardClick}
    >
      <div className="flex flex-col h-full">
        {/* Image Section */}
        <div className="relative overflow-hidden h-48 rounded-t-xl">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          
          {/* Favorite Button */}
          {session && (
            <button
              onClick={toggleFavorite}
              className={cn(
                "absolute top-3 right-3 p-2 rounded-full transition-all duration-200",
                "backdrop-blur-sm bg-white/20 hover:bg-white/40",
                favorited 
                  ? "text-red-500" 
                  : "text-white hover:text-red-500"
              )}
            >
              <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
            </button>
          )}
        </div>
        
        <div className="relative p-6 flex flex-col flex-grow bg-white">
          {/* Category Tag */}
          <div className="mb-3">
            <span className={cn(
              "inline-block px-3 py-1 text-xs font-semibold tracking-wide rounded-md",
              getCategoryColor(category)
            )}>
              {category}
            </span>
          </div>
          
          {/* Title */}
          <h3 className="text-gray-900 font-bold font-sans leading-tight mb-3 text-xl line-clamp-2">
            {title}
          </h3>
          
          {/* Description */}
          <p className="text-gray-600 text-sm line-clamp-3 mb-4 leading-relaxed flex-grow">
            {prompt_text}
          </p>
          
          {/* Action Button */}
          <div className="mt-auto">
            <Button 
              variant="outline" 
              className="w-full border-warm-gold/30 text-warm-gold hover:bg-warm-gold hover:text-white transition-all duration-200 rounded-lg font-medium"
            >
              View Details
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


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
  isLarge?: boolean;
  colorIndex: number;
  bgColors: string[];
  onCardClick: () => void;
  className?: string;
}

export function MagazinePromptCard({
  prompt,
  isLarge = false,
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
  const bgColor = bgColors[colorIndex];
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

  return (
    <div 
      className={cn(
        "group cursor-pointer overflow-hidden",
        bgColor,
        isLarge 
          ? "h-full aspect-[3/4] sm:aspect-[3/4]" 
          : "aspect-[2/1] sm:aspect-[2/1]",
        "transition-all duration-300 hover:shadow-lg",
        className
      )}
      onClick={onCardClick}
    >
      <div className="flex flex-col h-full">
        <div className="relative p-4 flex flex-col flex-grow">
          {/* Category Tag */}
          <div className="mb-2">
            <span className="inline-block bg-warm-gold/80 text-white px-2 py-1 text-xs font-medium tracking-wide">
              {category}
            </span>
          </div>
          
          {/* Title */}
          <h3 className={cn(
            "text-dark-base font-bold font-sans leading-tight mb-2",
            isLarge ? "text-2xl md:text-3xl" : "text-xl"
          )}>
            {title}
          </h3>
          
          {/* Description */}
          <p className="text-dark-base/70 text-sm line-clamp-2 mb-4">
            {prompt_text}
          </p>
          
          {/* Favorite Button */}
          {session && (
            <button
              onClick={toggleFavorite}
              className={cn(
                "absolute top-4 right-4 p-2 rounded-full",
                favorited 
                  ? "bg-warm-gold text-white" 
                  : "bg-white/80 text-warm-gold hover:bg-white"
              )}
            >
              <Heart className={cn("h-4 w-4", favorited ? "fill-white" : "")} />
            </button>
          )}
          
          {/* Action Button */}
          <div className="mt-auto">
            <Button 
              variant="outline" 
              className="bg-white border-warm-gold/30 text-warm-gold hover:bg-warm-gold hover:text-white px-4 py-2 text-sm"
            >
              {prompt_type === 'text' ? 'Copy Prompt' : 'View Details'}
            </Button>
          </div>
        </div>
        
        {/* Image Section */}
        <div className={cn(
          "relative overflow-hidden",
          isLarge ? "mt-auto h-[40%]" : "mt-auto h-[30%]" 
        )}>
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>
      </div>
    </div>
  );
}

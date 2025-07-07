
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { type Prompt } from "@/types";
import { Heart, User } from "lucide-react";
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
  const [imageUrl, setImageUrl] = useState<string>('/placeholder.svg');
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
        setImageUrl('/placeholder.svg');
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

  // Get category badge color based on type
  const getCategoryBadgeStyle = (type: string, cat: string) => {
    if (type === 'text' || cat.toLowerCase() === 'chatgpt') {
      return 'bg-[#c49d68] text-white';
    } else if (type === 'image' || cat.toLowerCase() === 'midjourney') {
      return 'bg-[#7a9e9f] text-white';
    } else if (type === 'workflow' || cat.toLowerCase() === 'n8n') {
      return 'bg-blue-600 text-white';
    }
    return 'bg-[#c49d68] text-white';
  };

  return (
    <div 
      className={cn(
        "group cursor-pointer overflow-hidden bg-soft-bg rounded-2xl shadow-md border-0",
        "transition-all duration-300 hover:shadow-xl hover:scale-[1.02]",
        // Mobile-first responsive padding and spacing
        "p-4 sm:p-6 space-y-3 sm:space-y-4 flex flex-col",
        "touch-manipulation", // Better touch handling
        className
      )}
      onClick={onCardClick}
    >
      {/* Category Tag and Favorite */}
      <div className="flex items-start justify-between">
        <span className={cn(
          "inline-block px-2 py-1 text-xs font-medium rounded-lg",
          "sm:px-3", // Larger padding on larger screens
          getCategoryBadgeStyle(prompt_type, category)
        )}>
          {category}
        </span>
        
        {/* Mobile-optimized favorite button */}
        {session && (
          <button
            onClick={toggleFavorite}
            className={cn(
              // Enhanced touch target for mobile
              "p-2 rounded-full transition-all duration-200 min-h-[44px] min-w-[44px]",
              "flex items-center justify-center",
              "hover:bg-white/30",
              favorited 
                ? "text-[#c49d68]" 
                : "text-gray-400 hover:text-[#c49d68]"
            )}
          >
            <Heart className={cn("h-4 w-4 sm:h-5 sm:w-5", favorited && "fill-current")} />
          </button>
        )}
      </div>
      
      {/* Responsive title */}
      <h3 className="text-gray-900 font-bold leading-tight flex-shrink-0">
        <span className="block text-lg sm:text-xl line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem]">
          {title}
        </span>
      </h3>
      
      {/* Mobile-optimized image */}
      {showImage && (
        <div className="relative overflow-hidden rounded-xl bg-white/50 flex-shrink-0">
          {/* Mobile: 16:9 aspect ratio, larger screens: 4:3 */}
          <div className="aspect-video sm:aspect-[4/3]">
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          </div>
        </div>
      )}
      
      {/* Description with responsive line clamping */}
      <p className="text-gray-600 text-sm leading-relaxed flex-grow line-clamp-2 sm:line-clamp-3">
        {prompt_text}
      </p>
      
      {/* Mobile-optimized tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {tags.slice(0, 3).map((tag, i) => (
            <span 
              key={i}
              className="px-2 py-1 bg-white/60 text-gray-700 text-xs rounded-md border border-gray-200"
            >
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="px-2 py-1 bg-white/60 text-gray-500 text-xs rounded-md border border-gray-200">
              +{tags.length - 3} more
            </span>
          )}
        </div>
      )}
      
      {/* Uploader info */}
      {(prompt as any).uploader_name && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <User className="h-3 w-3" />
          <span>by @{(prompt as any).uploader_name}</span>
        </div>
      )}
      
      {/* Mobile-optimized action button */}
      <div className="mt-auto pt-2 flex-shrink-0">
        <Button 
          className="w-full bg-[#c49d68] hover:bg-[#c49d68]/90 text-white font-semibold py-3 rounded-xl shadow-md transition-all duration-200 text-sm sm:text-base"
        >
          View Details
        </Button>
      </div>
    </div>
  );
}

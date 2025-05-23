
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { type Prompt } from "@/types";
import { Heart } from "lucide-react";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";
import { getPromptImage, getTextPromptDefaultImage } from "@/utils/image";
import { Button } from "./button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface TextPromptCardProps {
  prompt: Prompt;
  className?: string;
}

export function TextPromptCard({ prompt, className }: TextPromptCardProps) {
  const { title, prompt_text, metadata } = prompt;
  const tags = metadata?.tags || [];
  const category = metadata?.category || "ChatGPT";
  const model = metadata?.target_model || 'ChatGPT';
  const useCase = metadata?.use_case;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('/img/placeholder.png');
  const [favorited, setFavorited] = useState(false);
  const { session } = useAuth();

  // Use the default_image_path from the prompt, or if not available, use textpromptdefaultimg.jpg
  const imagePath = prompt.default_image_path || 'textpromptdefaultimg.jpg';

  useEffect(() => {
    async function loadImage() {
      try {
        const url = imagePath === 'textpromptdefaultimg.jpg' 
          ? await getTextPromptDefaultImage()
          : await getPromptImage(imagePath, 400, 80);
          
        console.log(`Loading text prompt image from path: ${imagePath}, URL: ${url}`);
        setImageUrl(url);
      } catch (error) {
        console.error('Error loading text prompt image:', error);
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
  }, [imagePath, prompt.id, session]);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
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
    <>
      <div 
        className={cn(
          "group cursor-pointer overflow-hidden bg-soft-bg rounded-2xl shadow-md border-0",
          "transition-all duration-300 hover:shadow-xl hover:scale-[1.02]",
          "p-6 space-y-4 min-h-[400px] flex flex-col",
          className
        )}
        onClick={() => setDetailsOpen(true)}
      >
        {/* Category Tag and Favorite */}
        <div className="flex items-start justify-between">
          <span className="inline-block px-3 py-1 text-xs font-medium rounded-lg bg-[#c49d68] text-white">
            {category}
          </span>
          
          {session && (
            <button
              onClick={handleToggleFavorite}
              className={cn(
                "p-2 rounded-full transition-all duration-200",
                "hover:bg-white/30",
                favorited 
                  ? "text-[#c49d68]" 
                  : "text-gray-400 hover:text-[#c49d68]"
              )}
            >
              <Heart className={cn("h-5 w-5", favorited && "fill-current")} />
            </button>
          )}
        </div>
        
        {/* Title */}
        <h3 className="text-gray-900 font-bold text-xl leading-tight line-clamp-2 min-h-[3rem]">
          {title}
        </h3>
        
        {/* Image */}
        <div className="relative overflow-hidden rounded-xl h-48 bg-white/50">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>
        
        {/* Description */}
        <p className="text-gray-600 text-sm line-clamp-3 leading-relaxed flex-grow">
          {prompt_text}
        </p>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-white/60 text-gray-700 text-xs rounded-md border border-gray-200">
            {model}
          </span>
          {useCase && (
            <span className="px-2 py-1 bg-white/60 text-gray-700 text-xs rounded-md border border-gray-200">
              {useCase}
            </span>
          )}
          {tags.slice(0, 2).map((tag, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-white/60 text-gray-700 text-xs rounded-md border border-gray-200"
            >
              {tag}
            </span>
          ))}
          {tags.length > 2 && (
            <span className="px-2 py-1 bg-white/60 text-gray-500 text-xs rounded-md border border-gray-200">
              +{tags.length - 2} more
            </span>
          )}
        </div>
        
        {/* Action Button */}
        <div className="mt-auto pt-2">
          <Button 
            className="w-full bg-[#c49d68] hover:bg-[#c49d68]/90 text-white font-semibold py-3 rounded-xl shadow-md transition-all duration-200"
          >
            View Details
          </Button>
        </div>
      </div>

      <PromptDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        prompt={prompt}
      />
    </>
  );
}

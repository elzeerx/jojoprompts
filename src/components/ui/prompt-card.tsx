import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { type Prompt, type PromptRow } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";
import { getPromptImage } from "@/utils/image";
import { Lock, Crown, Heart, Play, FileAudio } from "lucide-react";
import { Button } from "./button";
import { ImageWrapper } from "./prompt-card/ImageWrapper";

interface PromptCardProps {
  prompt: Prompt | PromptRow;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (promptId: string) => void;
  isAdmin?: boolean;
  onEdit?: (promptId: string) => void;
  onDelete?: (promptId: string) => void;
  initiallyFavorited?: boolean;
  isLocked?: boolean;
  onUpgradeClick?: () => void;
}

export function PromptCard({
  prompt,
  isSelectable = false,
  isSelected = false,
  onSelect,
  isAdmin = false,
  onEdit,
  onDelete,
  initiallyFavorited = false,
  isLocked = false,
  onUpgradeClick
}: PromptCardProps) {
  const {
    title,
    prompt_text,
    metadata,
    prompt_type
  } = prompt;
  const category = metadata?.category || "ChatGPT";
  const tags = metadata?.tags || [];
  const mediaFiles = metadata?.media_files || [];
  const {
    session
  } = useAuth();
  const [favorited, setFavorited] = useState<boolean>(initiallyFavorited);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('/img/placeholder.png');

  // Get the primary image to display - prioritize the first image from media_files, then fallback to image_path
  const primaryImagePath = mediaFiles.find(file => file.type === 'image')?.path || prompt.image_path || prompt.image_url || null;

  useEffect(() => {
    async function loadImage() {
      if (primaryImagePath) {
        const url = await getPromptImage(primaryImagePath, 400, 85);
        setImageUrl(url);
      }
    }
    if (primaryImagePath) {
      loadImage();
    }
  }, [primaryImagePath]);

  const handleCardClick = () => {
    if (isLocked && onUpgradeClick) {
      onUpgradeClick();
    } else {
      setDetailsOpen(true);
    }
  };

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

  // Function to get media type icon
  const getMediaTypeIcon = (file: any) => {
    if (file.type === 'video') {
      return <Play className="h-4 w-4 text-white" />;
    } else if (file.type === 'audio') {
      return <FileAudio className="h-4 w-4 text-white" />;
    } 
    return null;
  };

  return (
    <>
      <div 
        className={cn(
          "group cursor-pointer overflow-hidden bg-soft-bg rounded-2xl shadow-md border-0",
          "transition-all duration-300 hover:shadow-xl hover:scale-[1.02]",
          "p-6 space-y-4 min-h-[400px] flex flex-col relative",
          isSelected && "ring-2 ring-[#c49d68] shadow-lg",
          isLocked && "opacity-95"
        )} 
        onClick={handleCardClick}
      >
        {isLocked && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-center justify-center z-20 rounded-2xl">
            <div className="bg-black/80 backdrop-blur-sm p-6 rounded-xl flex flex-col items-center text-center">
              <Lock className="h-8 w-8 text-[#c49d68] mb-3" />
              <p className="text-white font-semibold text-sm mb-1">Premium Content</p>
              <p className="text-white/80 text-xs mb-4 max-w-[200px]">Upgrade your plan to access this content</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-[#c49d68]/90 text-white hover:bg-[#c49d68] border-[#c49d68]"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onUpgradeClick) onUpgradeClick();
                }}
              >
                <Crown className="h-3 w-3 mr-2" />
                Upgrade Plan
              </Button>
            </div>
          </div>
        )}

        {/* Category Tag and Favorite */}
        <div className="flex items-start justify-between">
          <span className={cn(
            "inline-block px-3 py-1 text-xs font-medium rounded-lg",
            getCategoryBadgeStyle(prompt_type, category)
          )}>
            {category}
          </span>
          
          {session && (
            <button
              onClick={toggleFavorite}
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
        <div className="relative overflow-hidden rounded-xl aspect-square bg-white/50">
          <ImageWrapper 
            src={imageUrl}
            alt={title}
            aspect={1}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          
          {/* Media count indicator if multiple files */}
          {mediaFiles.length > 1 && (
            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
              +{mediaFiles.length - 1} files
            </div>
          )}
          
          {/* Add a special icon for video or audio content */}
          {mediaFiles.length > 0 && mediaFiles[0].type !== 'image' && (
            <div className="absolute bottom-2 left-2 bg-black/70 p-2 rounded-full">
              {getMediaTypeIcon(mediaFiles[0])}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-600 text-sm line-clamp-3 leading-relaxed flex-grow">
          {prompt_text}
        </p>
        
        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
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

        {/* Action Buttons */}
        <div className="mt-auto pt-2 space-y-3">
          {!isLocked && (
            <Button 
              className="w-full bg-[#c49d68] hover:bg-[#c49d68]/90 text-white font-semibold py-3 rounded-xl shadow-md transition-all duration-200"
            >
              View Details
            </Button>
          )}
          
          {isAdmin && (
            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 border-gray-300 hover:bg-gray-50"
                onClick={e => {
                  e.stopPropagation();
                  onEdit?.(prompt.id);
                }}
              >
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" 
                onClick={e => {
                  e.stopPropagation();
                  onDelete?.(prompt.id);
                }}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      {!isLocked && (
        <PromptDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} prompt={prompt as PromptRow} />
      )}
    </>
  );
}

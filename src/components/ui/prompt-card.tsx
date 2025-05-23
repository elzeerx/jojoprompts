
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";
import { CopyButton } from "./copy-button";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { type Prompt, type PromptRow } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";
import { getPromptImage } from "@/utils/image";
import { ImageWrapper } from "./prompt-card/ImageWrapper";
import { CardActions } from "./prompt-card/CardActions";
import { Lock, Crown, Heart } from "lucide-react";

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
  const {
    session
  } = useAuth();
  const [favorited, setFavorited] = useState<boolean>(initiallyFavorited);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('/img/placeholder.png');

  const imagePath = prompt.image_path || prompt.image_url || null;

  useEffect(() => {
    async function loadImage() {
      const url = await getPromptImage(imagePath, 400, 85);
      setImageUrl(url);
    }
    if (imagePath) {
      loadImage();
    }
  }, [imagePath]);

  const handleSelectChange = (checked: boolean) => {
    onSelect?.(prompt.id);
  };

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

  // Map prompt_type to human-readable format for the badge
  const getPromptTypeLabel = (type: string) => {
    switch(type) {
      case "text": return "ChatGPT";
      case "image": return "Midjourney";
      case "workflow": return "n8n Workflow";
      default: return category;
    }
  };

  const getPromptTypeColor = (type: string) => {
    switch(type) {
      case "text": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "image": return "bg-purple-100 text-purple-700 border-purple-200";
      case "workflow": return "bg-blue-100 text-blue-700 border-blue-200";
      default: return "bg-warm-gold/10 text-warm-gold border-warm-gold/20";
    }
  };

  return (
    <>
      <Card 
        className={cn(
          "group relative overflow-hidden transition-all duration-300 cursor-pointer",
          "border border-border/40 hover:border-warm-gold/40 hover:shadow-xl",
          "bg-white hover:bg-gradient-to-br hover:from-white hover:to-warm-gold/5",
          "rounded-xl shadow-sm hover:shadow-lg",
          isSelected && "ring-2 ring-warm-gold shadow-md",
          isLocked && "opacity-95"
        )} 
        onClick={handleCardClick}
      >
        {isLocked && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-center justify-center z-20 rounded-xl">
            <div className="bg-black/80 backdrop-blur-sm p-6 rounded-xl flex flex-col items-center text-center">
              <Lock className="h-8 w-8 text-warm-gold mb-3" />
              <p className="text-white font-semibold text-sm mb-1">Premium Content</p>
              <p className="text-white/80 text-xs mb-4 max-w-[200px]">Upgrade your plan to access this content</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-warm-gold/90 text-white hover:bg-warm-gold border-warm-gold"
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

        <div className="relative">
          <ImageWrapper 
            src={imageUrl} 
            alt={title} 
            aspect={1.3} 
            isCard={true} 
            className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {session && (
            <div className="absolute top-3 right-3">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full backdrop-blur-sm bg-white/10 hover:bg-white/20",
                  "transition-all duration-200",
                  favorited && "text-red-500 hover:text-red-600"
                )}
                onClick={toggleFavorite}
              >
                <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
              </Button>
            </div>
          )}
        </div>

        <CardHeader className="px-5 py-4 border-b border-border/30">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-lg font-bold tracking-tight line-clamp-2 text-gray-900 group-hover:text-warm-gold transition-colors duration-200">
              {title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className={cn(
              "px-3 py-1 text-xs font-semibold rounded-full border",
              getPromptTypeColor(prompt_type)
            )}>
              {getPromptTypeLabel(prompt_type)}
            </span>
            {category !== getPromptTypeLabel(prompt_type) && (
              <span className="px-3 py-1 bg-gray-50 text-gray-600 text-xs font-medium rounded-full border border-gray-200">
                {category}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 font-mono bg-gray-50 p-3 rounded-lg border border-gray-100">
            {prompt_text}
          </p>
          
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 3).map((tag, i) => (
                <span 
                  key={i}
                  className="px-2 py-1 bg-warm-gold/10 text-warm-gold text-xs font-medium rounded-md border border-warm-gold/20"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="px-2 py-1 border border-gray-200 text-xs font-medium rounded-md text-gray-500">
                  +{tags.length - 3} more
                </span>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="px-5 py-4 border-t border-border/30 space-y-3 bg-gray-50/50">
          {!isLocked && (
            <CopyButton 
              value={prompt_text} 
              className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-lg h-10 font-medium transition-colors duration-200"
            />
          )}
          
          {isAdmin && (
            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 border-gray-200 hover:bg-gray-50"
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
        </CardFooter>
      </Card>

      {!isLocked && (
        <PromptDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} prompt={prompt as PromptRow} />
      )}
    </>
  );
}

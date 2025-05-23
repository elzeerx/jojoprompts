
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
import { Lock, Crown } from "lucide-react";

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
          "border border-border/50 hover:border-warm-gold/30 hover:shadow-lg",
          "bg-white hover:bg-warm-gold/5",
          isSelected && "ring-2 ring-warm-gold shadow-md",
          isLocked && "opacity-95"
        )} 
        onClick={handleCardClick}
      >
        {isLocked && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-center justify-center z-20 rounded-lg">
            <div className="bg-black/80 backdrop-blur-sm p-4 rounded-xl flex flex-col items-center text-center">
              <Lock className="h-8 w-8 text-warm-gold mb-2" />
              <p className="text-white font-semibold text-sm mb-1">Premium Content</p>
              <p className="text-white/80 text-xs mb-3 max-w-[200px]">Upgrade your plan to access this content</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-warm-gold/90 text-white hover:bg-warm-gold border-warm-gold"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onUpgradeClick) onUpgradeClick();
                }}
              >
                <Crown className="h-3 w-3 mr-1" />
                Upgrade Plan
              </Button>
            </div>
          </div>
        )}

        <div className="relative">
          <ImageWrapper 
            src={imageUrl} 
            alt={title} 
            aspect={1.2} 
            isCard={true} 
            className="w-full object-cover"
          />
          <CardActions 
            favorited={favorited} 
            onToggleFavorite={toggleFavorite} 
            className="absolute top-2 right-2"
          />
        </div>

        <CardHeader className="px-4 py-3 border-b border-border/50">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg font-semibold tracking-tight line-clamp-2 text-dark-base group-hover:text-warm-gold transition-colors">
              {title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn(
              "px-2 py-1 text-xs font-medium rounded-md border",
              getPromptTypeColor(prompt_type)
            )}>
              {getPromptTypeLabel(prompt_type)}
            </span>
            {category !== getPromptTypeLabel(prompt_type) && (
              <span className="px-2 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-md">
                {category}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-4 py-3 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 font-mono bg-muted/30 p-2 rounded-md">
            {prompt_text}
          </p>
          
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.slice(0, 3).map((tag, i) => (
                <span 
                  key={i}
                  className="px-2 py-0.5 bg-secondary/70 text-secondary-foreground text-xs font-medium rounded-md border border-secondary"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="px-2 py-0.5 border border-border text-xs font-medium rounded-md text-muted-foreground">
                  +{tags.length - 3} more
                </span>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="px-4 py-3 border-t border-border/50 space-y-2">
          {!isLocked && (
            <CopyButton 
              value={prompt_text} 
              className="w-full bg-dark-base hover:bg-dark-base/90 text-white rounded-lg"
            />
          )}
          
          {isAdmin && (
            <div className="flex gap-2 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
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
                className="flex-1 text-destructive hover:text-destructive" 
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

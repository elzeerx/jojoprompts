
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
import { TagList } from "./prompt-card/TagList";
import { Lock } from "lucide-react";

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
  const category = metadata?.category || "ChatGPT"; // Default to ChatGPT if no category
  const tags = metadata?.tags || [];
  const {
    session
  } = useAuth();
  const [favorited, setFavorited] = useState<boolean>(initiallyFavorited);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('/img/placeholder.png');
  const aspect = 1;

  const imagePath = prompt.image_path || prompt.image_url || null;

  useEffect(() => {
    async function loadImage() {
      const url = await getPromptImage(imagePath, 300, 80);
      setImageUrl(url);
    }
    if (imagePath) {
      loadImage();
    }
  }, [imagePath]);

  useEffect(() => {
    console.debug(`Card image path: ${imagePath}`);
    console.debug(`Card image URL: ${imageUrl}`);
  }, [imagePath, imageUrl]);

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

  return (
    <>
      <Card 
        className={cn(
          "overflow-hidden transition-all duration-200 hover:shadow-xl group cursor-pointer rounded-xl relative",
          "border border-border hover:border-primary/50",
          isSelected && "ring-1 ring-primary",
          isLocked && "opacity-90"
        )} 
        onClick={handleCardClick}
      >
        {isLocked && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 rounded-xl">
            <div className="bg-black/70 p-4 rounded-xl flex flex-col items-center">
              <Lock className="h-8 w-8 text-warm-gold mb-2" />
              <p className="text-white font-medium text-center">Upgrade to unlock</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 bg-warm-gold text-white hover:bg-warm-gold/90 border-none"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onUpgradeClick) onUpgradeClick();
                }}
              >
                Upgrade Plan
              </Button>
            </div>
          </div>
        )}

        <div className="relative">
          <ImageWrapper 
            src={imageUrl} 
            alt={title} 
            aspect={aspect} 
            isCard={true} 
            className="w-full aspect-square object-cover rounded-t-xl"
          />
          <CardActions favorited={favorited} onToggleFavorite={toggleFavorite} className="bottom-2 right-2 top-auto" />
        </div>
        <CardHeader className="px-4 py-3 border-b border-border">
          <CardTitle className="text-lg font-bold tracking-tight line-clamp-1">
            {title}
          </CardTitle>
          <div className="mt-2">
            <span className="bg-warm-gold/10 text-warm-gold px-2 py-0.5 text-xs font-medium inline-block rounded-md">
              {getPromptTypeLabel(prompt_type)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="px-4 py-3 space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 min-h-[4em] font-mono">
            {prompt_text}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.slice(0, 3).map((tag, i) => (
              <span 
                key={i}
                className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs font-mono inline-block rounded-md"
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="px-2 py-0.5 border border-border text-xs font-mono rounded-md">
                +{tags.length - 3}
              </span>
            )}
          </div>
        </CardContent>
        <CardFooter className="px-4 py-3 border-t border-border">
          {!isLocked && (
            <CopyButton value={prompt_text} className="flex-shrink-0 w-full rounded-lg" />
          )}
          {isAdmin && 
            <div className="flex gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={e => {
                e.stopPropagation();
                onEdit?.(prompt.id);
              }}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={e => {
                e.stopPropagation();
                onDelete?.(prompt.id);
              }}>
                Delete
              </Button>
            </div>
          }
        </CardFooter>
      </Card>

      {!isLocked && (
        <PromptDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} prompt={prompt as PromptRow} />
      )}
    </>
  );
}

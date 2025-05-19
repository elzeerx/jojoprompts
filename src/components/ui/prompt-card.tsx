
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

interface PromptCardProps {
  prompt: Prompt | PromptRow;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (promptId: string) => void;
  isAdmin?: boolean;
  onEdit?: (promptId: string) => void;
  onDelete?: (promptId: string) => void;
  initiallyFavorited?: boolean;
}

export function PromptCard({
  prompt,
  isSelectable = false,
  isSelected = false,
  onSelect,
  isAdmin = false,
  onEdit,
  onDelete,
  initiallyFavorited = false
}: PromptCardProps) {
  const {
    title,
    prompt_text,
    metadata
  } = prompt;
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
    <>
      <Card 
        className={cn(
          "overflow-hidden transition-all duration-200 hover:shadow-xl group cursor-pointer rounded-none",
          "border border-border hover:border-primary/50",
          isSelected && "ring-1 ring-primary"
        )} 
        onClick={() => setDetailsOpen(true)}
      >
        <div className="relative">
          <ImageWrapper 
            src={imageUrl} 
            alt={title} 
            aspect={aspect} 
            isCard={true} 
            className="w-full aspect-square object-cover" 
          />
          <CardActions favorited={favorited} onToggleFavorite={toggleFavorite} />
        </div>
        <CardHeader className="px-4 py-3 border-b border-border">
          <CardTitle className="text-lg font-bold tracking-tight line-clamp-1">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-3 space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 min-h-[4em] font-mono">
            {prompt_text}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.slice(0, 3).map((tag, i) => (
              <span 
                key={i}
                className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs font-mono inline-block"
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="px-2 py-0.5 border border-border text-xs font-mono">
                +{tags.length - 3}
              </span>
            )}
          </div>
        </CardContent>
        <CardFooter className="px-4 py-3 border-t border-border">
          <CopyButton value={prompt_text} className="flex-shrink-0 w-full rounded-none" />
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

      <PromptDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} prompt={prompt as PromptRow} />
    </>
  );
}

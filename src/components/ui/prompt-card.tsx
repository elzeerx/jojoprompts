
// PromptCard main file — refactored with atoms
import React, { useState } from "react";
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
  initiallyFavorited = false,
}: PromptCardProps) {
  const { title, prompt_text, metadata } = prompt;
  const tags = metadata?.tags || [];
  const { session } = useAuth();
  const [favorited, setFavorited] = useState<boolean>(initiallyFavorited);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const aspect = 4 / 3;

  // Use the universal helper, support both "image_path" (preferred) and "image_url" (legacy)
  const imgUrl = getPromptImage(prompt.image_path || prompt.image_url, 400, 80);

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
        variant: "destructive",
      });
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
      console.error("Error toggling favorite:", error);
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card
        className={cn(
          "overflow-hidden transition-all duration-200 hover:shadow-2xl hover:scale-[1.025] group cursor-pointer border border-border/50 hover:border-border/100 bg-gradient-to-b from-card to-card/95",
          isSelected && "ring-2 ring-primary"
        )}
        onClick={() => setDetailsOpen(true)}
      >
        <div className="relative">
          <ImageWrapper src={imgUrl} alt={title} aspect={aspect} />
          <CardActions
            favorited={favorited}
            onToggleFavorite={toggleFavorite}
            isSelectable={isSelectable}
            isSelected={isSelected}
            onSelect={handleSelectChange}
          />
        </div>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg font-semibold leading-tight tracking-tight line-clamp-1">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 min-h-[4em]">
            {prompt_text}
          </p>
          <TagList tags={tags} />
        </CardContent>
        <CardFooter className="p-4 pt-0 flex flex-wrap items-center gap-2">
          <CopyButton value={prompt_text} className="flex-shrink-0" />
          {isAdmin && (
            <div className="flex gap-2 ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  onEdit?.(prompt.id);
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
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
      <PromptDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} prompt={prompt} />
    </>
  );
}

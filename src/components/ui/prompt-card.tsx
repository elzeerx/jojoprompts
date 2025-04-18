import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { CopyButton } from "./copy-button";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Prompt, type PromptRow } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";
import { cdnUrl } from "@/utils/image";

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
  const { title, prompt_text, image_path, metadata } = prompt;
  const { session } = useAuth();
  const [favorited, setFavorited] = useState<boolean>(initiallyFavorited);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  const tags = metadata?.tags || [];
  
  const thumb = cdnUrl(prompt.image_path);
  const placeholderImage = "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&h=400&q=80";

  const handleSelectChange = () => {
    if (onSelect) {
      onSelect(prompt.id);
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
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <Card 
        className={cn(
          "overflow-hidden transition-all duration-200 hover:shadow-lg",
          "border border-border/50 hover:border-border/100",
          "bg-gradient-to-b from-card to-card/95",
          isSelected && "ring-2 ring-primary",
          "cursor-pointer"
        )}
        onClick={() => setDetailsOpen(true)}
      >
        <div className="relative">
          {isSelectable && (
            <div className="absolute top-3 left-3 z-10">
              <Checkbox 
                checked={isSelected}
                onCheckedChange={handleSelectChange}
                className="h-5 w-5 border-2 border-white bg-white/50 backdrop-blur-sm"
              />
            </div>
          )}
          {session && (
            <div className="absolute top-3 right-3 z-10">
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "h-8 w-8 rounded-full bg-white/50 backdrop-blur-sm",
                  "hover:bg-white/60 transition-colors",
                  favorited && "text-red-500 hover:text-red-600"
                )}
                onClick={toggleFavorite}
              >
                <Heart className={cn("h-5 w-5", favorited && "fill-current")} />
              </Button>
            </div>
          )}
          <div className="aspect-video relative bg-muted">
            {thumb ? (
              <img 
                src={thumb}
                alt={title}
                loading="lazy"
                className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary/5 to-primary/10">
                <img 
                  src={placeholderImage} 
                  alt="Placeholder"
                  loading="lazy"
                  className="object-cover w-full h-full opacity-50 transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            )}
          </div>
        </div>
        
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-lg font-semibold leading-tight tracking-tight line-clamp-1">
            {title}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-4 pt-2 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 min-h-[4.5rem]">
            {prompt_text}
          </p>
          
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.slice(0, 3).map((tag, i) => (
              <Badge 
                key={i} 
                variant="secondary" 
                className="text-xs font-medium px-2 py-0.5"
              >
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge 
                variant="outline" 
                className="text-xs font-medium px-2 py-0.5"
              >
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="p-4 pt-2 flex flex-wrap items-center gap-2">
          <CopyButton value={prompt_text} className="flex-shrink-0" />
          
          {isAdmin && (
            <div className="flex gap-2 ml-auto">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => {
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
                onClick={(e) => {
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

      <PromptDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        prompt={prompt}
      />
    </>
  );
}

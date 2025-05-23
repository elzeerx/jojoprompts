
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";
import { CopyButton } from "./copy-button";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import { type Prompt } from "@/types";
import { Heart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PromptDetailsDialog } from "./prompt-details-dialog";
import { getPromptImage, getTextPromptDefaultImage } from "@/utils/image";

interface PremiumPromptCardProps {
  prompt: Prompt;
  colorIndex: number;
  bgColors: string[];
  className?: string;
}

export function PremiumPromptCard({ 
  prompt, 
  colorIndex, 
  bgColors, 
  className 
}: PremiumPromptCardProps) {
  const { title, prompt_text, metadata, prompt_type } = prompt;
  const tags = metadata?.tags || [];
  const { session } = useAuth();
  const [favorited, setFavorited] = useState<boolean>(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('/placeholder.svg');
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
        setImageUrl('/placeholder.svg');
      }
    }
    loadImage();
  }, [imagePath, isTextPrompt]);
  
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
          "overflow-hidden transition-all duration-200 hover:shadow-lg group cursor-pointer",
          "border border-warm-gold/10 hover:border-warm-gold/40",
          bgColor,
          className
        )} 
        onClick={() => setDetailsOpen(true)}
      >
        <div className="flex flex-col h-full">
          <div className="relative aspect-[4/3] overflow-hidden">
            <img 
              src={imageUrl} 
              alt={title} 
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
            />
            <button
              onClick={toggleFavorite}
              className={`absolute top-4 right-4 p-2 rounded-full ${
                favorited 
                  ? 'bg-warm-gold text-white' 
                  : 'bg-white/80 text-warm-gold hover:bg-white'
              } transition-colors`}
            >
              <Heart className={`h-4 w-4 ${favorited ? 'fill-white' : ''}`} />
            </button>
          </div>
          
          <CardHeader className="px-4 py-3 border-t border-warm-gold/10 bg-white">
            <CardTitle className="text-xl font-bold text-dark-base tracking-tight line-clamp-1">
              {title}
            </CardTitle>
            {/* Model or use case */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="bg-warm-gold/10 text-warm-gold px-2 py-0.5 text-xs font-medium">
                {prompt_type === 'text' ? 'ChatGPT' : 'Midjourney'}
              </span>
              {metadata?.use_case && (
                <span className="bg-muted-teal/10 text-muted-teal px-2 py-0.5 text-xs font-medium">
                  {metadata.use_case}
                </span>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="px-4 py-3 flex-grow bg-white">
            <p className="text-sm text-dark-base/80 leading-relaxed line-clamp-2 font-mono">
              {prompt_text}
            </p>
            
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="border border-warm-gold/20 px-2 py-0.5 text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="border border-warm-gold/20 px-2 py-0.5 text-xs font-medium">
                  +{tags.length - 3}
                </span>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="px-4 py-3 bg-white border-t border-warm-gold/10">
            <Button className="w-full bg-warm-gold hover:bg-warm-gold/90 text-white">
              {prompt_type === 'text' ? 'Copy Prompt' : 'View Details'}
            </Button>
          </CardFooter>
        </div>
      </Card>

      <PromptDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        prompt={prompt}
      />
    </>
  );
}

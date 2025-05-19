
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";
import { CopyButton } from "./copy-button";
import { Badge } from "./badge";
import { cn } from "@/lib/utils";
import { type Prompt } from "@/types";
import { BookText } from "lucide-react";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";
import { ImageWrapper } from "./prompt-card/ImageWrapper";
import { getPromptImage, getTextPromptDefaultImage } from "@/utils/image";
import { CardActions } from "./prompt-card/CardActions";

interface TextPromptCardProps {
  prompt: Prompt;
  className?: string;
}

export function TextPromptCard({ prompt, className }: TextPromptCardProps) {
  const { title, prompt_text, metadata } = prompt;
  const tags = metadata?.tags || [];
  const model = metadata?.target_model || 'ChatGPT';
  const useCase = metadata?.use_case;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('/img/placeholder.png');
  const [favorited, setFavorited] = useState(false);

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
  }, [imagePath]);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorited(!favorited);
  };

  return (
    <>
      <Card 
        className={cn(
          "overflow-hidden transition-all duration-300 hover:shadow-lg group cursor-pointer border-warm-gold/10 hover:border-warm-gold/30 bg-white",
          className
        )}
        onClick={() => setDetailsOpen(true)}
      >
        <div className="relative">
          <ImageWrapper 
            src={imageUrl} 
            alt={title} 
            aspect={4/3} 
            className="w-full object-cover" 
          />
          <CardActions 
            favorited={favorited} 
            onToggleFavorite={handleToggleFavorite}
            className="flex justify-end px-3"
          />
        </div>
        <CardHeader className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <BookText className="h-5 w-5 text-warm-gold flex-shrink-0" />
            <CardTitle className="text-lg font-bold leading-tight line-clamp-1 text-dark-base">
              {title}
            </CardTitle>
          </div>
          {useCase && (
            <span className="bg-warm-gold/10 text-warm-gold px-2 py-0.5 text-xs font-medium mt-2 inline-block">
              {useCase}
            </span>
          )}
        </CardHeader>
        <CardContent className="px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 font-mono">
            {prompt_text}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="border border-warm-gold/20 px-2 py-0.5 text-xs font-medium">
              {model}
            </span>
            {tags.slice(0, 2).map((tag, i) => (
              <span
                key={i}
                className="bg-muted-teal/10 text-muted-teal px-2 py-0.5 text-xs font-medium"
              >
                {tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="border border-border px-2 py-0.5 text-xs font-medium">
                +{tags.length - 2}
              </span>
            )}
          </div>
        </CardContent>
        <CardFooter className="px-4 py-3 border-t border-border">
          <CopyButton value={prompt_text} className="w-full bg-dark-base hover:bg-dark-base/90" />
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

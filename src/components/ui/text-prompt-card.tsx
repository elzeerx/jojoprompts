
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

  return (
    <>
      <Card 
        className={cn(
          "overflow-hidden transition-all duration-300 hover:shadow-lg group cursor-pointer rounded-xl",
          "backdrop-blur-md bg-white/10 border border-white/20 hover:border-white/40",
          "hover:transform hover:scale-[1.02] hover:shadow-xl",
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
        </div>
        <CardHeader className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <BookText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <CardTitle className="text-lg font-bold leading-tight line-clamp-1">
              {title}
            </CardTitle>
          </div>
          {useCase && (
            <span className="bg-white/10 text-white/80 px-2 py-0.5 text-xs font-mono mt-2 inline-block rounded-full">
              {useCase}
            </span>
          )}
        </CardHeader>
        <CardContent className="px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 font-mono">
            {prompt_text}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="border border-white/20 px-2 py-0.5 text-xs font-mono rounded-full">
              {model}
            </span>
            {tags.slice(0, 2).map((tag, i) => (
              <span
                key={i}
                className="bg-white/10 text-white/80 px-2 py-0.5 text-xs font-mono rounded-full"
              >
                {tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="border border-white/20 px-2 py-0.5 text-xs font-mono rounded-full">
                +{tags.length - 2}
              </span>
            )}
          </div>
        </CardContent>
        <CardFooter className="px-4 py-3 border-t border-white/10">
          <CopyButton value={prompt_text} className="w-full rounded-full" />
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

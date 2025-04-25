
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

  // Fetch the image URL when the component mounts or the imagePath changes
  useEffect(() => {
    async function loadImage() {
      try {
        // If this is the default image, use the specific function that knows to look in the default-prompt-images bucket
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
          "overflow-hidden transition-all duration-200 hover:shadow-lg group cursor-pointer bg-gradient-to-b from-card to-card/95 h-[32rem] flex flex-col",
          className
        )}
        onClick={() => setDetailsOpen(true)}
      >
        <div className="relative h-48">
          <ImageWrapper src={imageUrl} alt={title} aspect={4/3} className="w-full h-full object-cover" />
        </div>
        <CardHeader className="p-4 pb-2 flex items-start gap-3 flex-none">
          <BookText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg font-semibold leading-tight line-clamp-1">
              {title}
            </CardTitle>
            {useCase && (
              <Badge variant="secondary" className="text-xs">
                {useCase}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-2 flex-grow">
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
            {prompt_text}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-xs font-medium">
              {model}
            </Badge>
            {tags.slice(0, 2).map((tag, i) => (
              <Badge
                key={i}
                variant="secondary"
                className="text-xs font-medium"
              >
                {tag}
              </Badge>
            ))}
            {tags.length > 2 && (
              <Badge variant="outline" className="text-xs font-medium">
                +{tags.length - 2}
              </Badge>
            )}
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-0 flex-none">
          <CopyButton value={prompt_text} className="w-full" />
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


import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type PromptRow } from "@/types";
import { getPromptImage } from "@/utils/image";
import { useEffect, useState } from "react";
import { ImageWrapper } from "./prompt-card/ImageWrapper";

interface PromptDetailsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prompt: PromptRow | null;
  promptList?: PromptRow[];
}

export function PromptDetailsDialog({
  open,
  onOpenChange,
  prompt,
  promptList = [],
}: PromptDetailsDialogProps) {
  if (!prompt) return null;
  
  const [dialogImgUrl, setDialogImgUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (promptList.length > 0 && !promptList.find(p => p.id === prompt.id)) {
      onOpenChange(false);
    }
  }, [promptList, prompt.id, onOpenChange]);

  // Use either image_path or image_url, with image_path having priority
  const imagePath = prompt.image_path || prompt.image_url || null;
  
  // Set image URL when the dialog opens or prompt changes
  useEffect(() => {
    if (open && imagePath) {
      // For detailed view, use higher quality
      const imageUrl = getPromptImage(imagePath, 1200, 90);
      setDialogImgUrl(imageUrl);
      console.log("Details dialog image path:", imagePath);
      console.log("Details dialog image URL:", imageUrl);
    } else {
      setDialogImgUrl(null);
    }
  }, [open, imagePath, prompt.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0" aria-describedby="prompt-details-description">
        <ScrollArea className="h-full max-h-[85vh]">
          <div className="p-6 flex flex-col space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tight">
                {prompt.title}
              </DialogTitle>
              <DialogDescription id="prompt-details-description" className="text-muted-foreground">
                View details and content for this prompt
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl overflow-hidden max-w-full mx-auto">
              <ImageWrapper
                src={dialogImgUrl}
                alt={prompt.title}
                aspect={16/9}
                className="cursor-zoom-in transition-all duration-300"
                onClick={() => {
                  if (imagePath) {
                    const fullImage = getPromptImage(imagePath, 2000, 100);
                    if (fullImage) window.open(fullImage, "_blank", "noopener,noreferrer");
                  }
                }}
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Prompt Text</h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{prompt.prompt_text}</p>
              </div>
            </div>

            {(prompt.metadata?.category ||
              prompt.metadata?.style ||
              prompt.metadata?.tags?.length > 0) && (
              <div>
                <h3 className="text-sm font-medium mb-3">Details</h3>
                <div className="flex flex-wrap gap-2">
                  {prompt.metadata?.category && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                      {prompt.metadata.category}
                    </Badge>
                  )}
                  {prompt.metadata?.style && (
                    <Badge variant="secondary" className="bg-secondary/30 hover:bg-secondary/40">
                      {prompt.metadata.style}
                    </Badge>
                  )}
                  {prompt.metadata?.tags?.map(tag => (
                    <Badge key={tag} variant="outline" className="hover:bg-accent">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default PromptDetailsDialog;

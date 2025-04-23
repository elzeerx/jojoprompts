
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type PromptRow } from "@/types";
import { getPromptImage } from "@/utils/image";
import { useEffect, useState } from "react";
import { ImageWrapper } from "./prompt-card/ImageWrapper";
import { Skeleton } from "./skeleton";
import { AlertCircle } from "lucide-react";

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
  promptList = []
}: PromptDetailsDialogProps) {
  if (!prompt) return null;
  
  const [dialogImgUrl, setDialogImgUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [imageRetried, setImageRetried] = useState(false);

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
      setImageLoading(true);
      setImageError(false);
      setImageRetried(false);
      console.log("Details dialog image path:", imagePath);
      console.log("Details dialog image URL:", imageUrl);
    } else {
      setDialogImgUrl(null);
    }
  }, [open, imagePath, prompt.id]);

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    console.error("Failed to load image in details dialog:", dialogImgUrl);
    setImageLoading(false);
    setImageError(true);
    
    // Try one more time with direct URL if we haven't already
    if (!imageRetried && imagePath) {
      setImageRetried(true);
      // Try with direct image URL from Supabase as a last resort
      const directUrl = `https://fxkqgjakbyrxkmevkglv.supabase.co/storage/v1/object/public/prompt-images/${encodeURIComponent(imagePath)}`;
      console.log("Trying direct URL as fallback:", directUrl);
      setDialogImgUrl(directUrl);
    }
  };

  const handleImageRetry = () => {
    if (imagePath) {
      setImageLoading(true);
      setImageError(false);
      setImageRetried(false);
      const refreshedUrl = getPromptImage(imagePath, 1200, 90) + `&t=${Date.now()}`;
      console.log("Retrying with refreshed URL:", refreshedUrl);
      setDialogImgUrl(refreshedUrl);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[85vh] p-0" 
        aria-describedby="prompt-details-description"
      >
        <ScrollArea className="h-full max-h-[85vh]">
          <div className="p-6 flex flex-col space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tight">
                {prompt.title}
              </DialogTitle>
              <DialogDescription id="prompt-details-description" className="text-sm text-muted-foreground">
                View all details for this prompt
              </DialogDescription>
            </DialogHeader>

            {imagePath ? (
              <div className="rounded-xl overflow-hidden max-w-full mx-auto relative">
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Skeleton className="h-full w-full rounded-xl" />
                  </div>
                )}
                {imageError ? (
                  <div className="bg-muted/50 aspect-video flex items-center justify-center flex-col gap-2 p-4">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    <span className="text-muted-foreground text-center">Image could not be loaded</span>
                    <button 
                      onClick={handleImageRetry}
                      className="mt-2 px-3 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  <ImageWrapper 
                    src={dialogImgUrl} 
                    alt={prompt.title} 
                    aspect={16 / 9} 
                    className="cursor-zoom-in transition-all duration-300"
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    onClick={() => {
                      if (imagePath && !imageError) {
                        const fullImage = getPromptImage(imagePath, 2000, 100);
                        if (fullImage) window.open(fullImage, "_blank", "noopener,noreferrer");
                      }
                    }} 
                  />
                )}
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden bg-muted/50 flex items-center justify-center aspect-video">
                <span className="text-muted-foreground text-lg">No image available</span>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-2">Prompt Text</h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{prompt.prompt_text}</p>
              </div>
            </div>

            {(prompt.metadata?.category || prompt.metadata?.style || prompt.metadata?.tags?.length > 0) && (
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

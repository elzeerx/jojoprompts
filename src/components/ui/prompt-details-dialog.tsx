
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type PromptRow } from "@/types";
import { getPromptImage, getTextPromptDefaultImage } from "@/utils/image";
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
  
  useEffect(() => {
    if (promptList.length > 0 && !promptList.find(p => p.id === prompt.id)) {
      onOpenChange(false);
    }
  }, [promptList, prompt.id, onOpenChange]);

  // For text prompts, use the default image path or fallback to the textpromptdefaultimg.jpg
  const imagePath = prompt.prompt_type === "text" 
    ? prompt.default_image_path || 'textpromptdefaultimg.jpg'
    : prompt.image_path || prompt.image_url || null;

  useEffect(() => {
    if (open && imagePath) {
      async function loadImage() {
        try {
          // Use specific function for default image
          const imgUrl = imagePath === 'textpromptdefaultimg.jpg'
            ? await getTextPromptDefaultImage()
            : await getPromptImage(imagePath, 1200, 90);
            
          setDialogImgUrl(imgUrl);
          setImageLoading(true);
          setImageError(false);
          console.log("Details dialog image path:", imagePath);
          console.log("Details dialog image URL:", imgUrl);
        } catch (error) {
          console.error("Error loading dialog image:", error);
          setImageError(true);
          setImageLoading(false);
        }
      }
      loadImage();
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
  };
  
  const handleImageRetry = () => {
    if (imagePath) {
      setImageLoading(true);
      setImageError(false);
      
      async function refreshImage() {
        try {
          const refreshedUrl = imagePath === 'textpromptdefaultimg.jpg'
            ? await getTextPromptDefaultImage() + `&t=${Date.now()}`
            : await getPromptImage(imagePath, 1200, 90) + `&t=${Date.now()}`;
            
          console.log("Retrying with refreshed URL:", refreshedUrl);
          setDialogImgUrl(refreshedUrl);
        } catch (error) {
          console.error("Error refreshing image:", error);
          setImageError(true);
          setImageLoading(false);
        }
      }
      
      refreshImage();
    }
  };

  const handleImageClick = async () => {
    if (imagePath && !imageError && !imageLoading) {
      try {
        const fullImage = imagePath === 'textpromptdefaultimg.jpg'
          ? await getTextPromptDefaultImage()
          : await getPromptImage(imagePath, 2000, 100);
          
        if (fullImage) window.open(fullImage, "_blank", "noopener,noreferrer");
      } catch (error) {
        console.error("Error opening full image:", error);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogDescription id="prompt-details-description" className="sr-only">
          Details for prompt: {prompt.title}
        </DialogDescription>
        <ScrollArea className="h-full max-h-[85vh]">
          <div className="p-6 flex flex-col space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tight">
                {prompt.title}
              </DialogTitle>
            </DialogHeader>

            {imagePath ? (
              <div className="rounded-xl overflow-hidden bg-muted/50 flex items-center justify-center">
                <ImageWrapper 
                  src={dialogImgUrl} 
                  alt={prompt.title} 
                  className="w-full"
                  disableAspectRatio={true}
                  isCard={false}
                  onLoad={handleImageLoad} 
                  onError={handleImageError} 
                  onClick={handleImageClick}
                />
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden bg-muted/50 flex items-center justify-center p-12">
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

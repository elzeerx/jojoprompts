import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type PromptRow } from "@/types";
import { getPromptImage, getTextPromptDefaultImage } from "@/utils/image";
import { useEffect, useState } from "react";
import { ImageWrapper } from "./prompt-card/ImageWrapper";
import { Skeleton } from "./skeleton";
import { AlertCircle, Copy } from "lucide-react";
import { Button } from "./button";
import { CopyButton } from "./copy-button";
import { toast } from "@/hooks/use-toast"; // Import toast from the correct location

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

  // Format date to BINSOO style
  const formatDate = () => {
    if (prompt.created_at) {
      const date = new Date(prompt.created_at);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      }).toUpperCase();
    }
    return "N/A";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 rounded-none border border-border">
        <DialogDescription id="prompt-details-description" className="sr-only">
          Details for prompt: {prompt.title}
        </DialogDescription>
        <ScrollArea className="h-full max-h-[85vh]">
          <div className="flex flex-col">
            <div className="relative">
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
              <div className="absolute top-4 right-4 font-mono text-sm bg-black/50 text-white px-3 py-1">
                {formatDate()}
              </div>
            </div>
            
            <div className="p-6">
              <DialogHeader className="text-left mb-6">
                <DialogTitle className="text-3xl font-extrabold tracking-tight">
                  {prompt.title}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <h3 className="text-lg font-bold mb-3">Prompt Text</h3>
                  <div className="bg-muted/50 p-4 font-mono text-sm relative group">
                    <p className="whitespace-pre-wrap text-muted-foreground">{prompt.prompt_text}</p>
                    <CopyButton
                      value={prompt.prompt_text}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-none"
                    />
                  </div>
                </div>
                
                <div className="border-l border-border pl-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-4 font-mono">Technical Details</h3>
                  <dl className="space-y-4 font-mono text-sm">
                    {prompt.metadata?.category && (
                      <div className="flex flex-col">
                        <dt className="text-muted-foreground uppercase text-xs mb-1">Category</dt>
                        <dd className="font-medium">{prompt.metadata.category}</dd>
                      </div>
                    )}
                    {prompt.metadata?.style && (
                      <div className="flex flex-col">
                        <dt className="text-muted-foreground uppercase text-xs mb-1">Style</dt>
                        <dd className="font-medium">{prompt.metadata.style}</dd>
                      </div>
                    )}
                    {prompt.metadata?.target_model && (
                      <div className="flex flex-col">
                        <dt className="text-muted-foreground uppercase text-xs mb-1">Model</dt>
                        <dd className="font-medium">{prompt.metadata.target_model}</dd>
                      </div>
                    )}
                    {prompt.metadata?.tags?.length > 0 && (
                      <div className="flex flex-col">
                        <dt className="text-muted-foreground uppercase text-xs mb-1">Tags</dt>
                        <dd className="flex flex-wrap gap-2 mt-1">
                          {prompt.metadata.tags.map(tag => (
                            <span 
                              key={tag} 
                              className="bg-secondary text-secondary-foreground px-2 py-0.5 text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
              
              <div className="mt-8 flex justify-center">
                <Button 
                  className="w-full max-w-sm rounded-none font-bold text-base py-6"
                  onClick={() => {
                    navigator.clipboard.writeText(prompt.prompt_text);
                    toast({
                      title: "Copied to clipboard",
                      description: "Prompt text has been copied to your clipboard",
                    });
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Prompt
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default PromptDetailsDialog;

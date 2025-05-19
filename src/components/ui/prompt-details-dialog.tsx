
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type PromptRow, type Prompt } from "@/types";
import { getPromptImage, getTextPromptDefaultImage } from "@/utils/image";
import { useEffect, useState } from "react";
import { Copy, Check, Heart } from "lucide-react";
import { Button } from "./button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PromptDetailsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prompt: PromptRow | Prompt | null;
  promptList?: PromptRow[];
}

export function PromptDetailsDialog({
  open,
  onOpenChange,
  prompt,
  promptList = []
}: PromptDetailsDialogProps) {
  if (!prompt) return null;
  
  const { session } = useAuth();
  const [dialogImgUrl, setDialogImgUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const category = prompt.metadata?.category || "General";
  const tags = prompt.metadata?.tags || [];
  
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
    
    // Check if prompt is favorited by current user
    if (session && open) {
      const checkFavoriteStatus = async () => {
        const { data } = await supabase
          .from("favorites")
          .select()
          .eq("user_id", session.user.id)
          .eq("prompt_id", prompt.id);
        
        setFavorited(!!data && data.length > 0);
      };
      
      checkFavoriteStatus();
    }
  }, [open, imagePath, prompt.id, session]);
  
  const handleCopyClick = () => {
    navigator.clipboard.writeText(prompt.prompt_text);
    setCopied(true);
    
    setTimeout(() => {
      setCopied(false);
    }, 2000);
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

  // Format date to readable style
  const formatDate = () => {
    if (prompt.created_at) {
      const date = new Date(prompt.created_at);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      });
    }
    return "N/A";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 border-none rounded-none overflow-hidden">
        <DialogDescription id="prompt-details-description" className="sr-only">
          Details for prompt: {prompt.title}
        </DialogDescription>
        <ScrollArea className="max-h-[80vh]">
          <div className="flex flex-col bg-soft-bg">
            {/* Hero Section */}
            <div className="relative h-[300px]">
              {dialogImgUrl && (
                <img
                  src={dialogImgUrl}
                  alt={prompt.title}
                  className="w-full h-full object-cover"
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageError(true)}
                />
              )}
              <div className="absolute inset-0 bg-black/30" />
              
              <div className="absolute top-0 left-0 right-0 p-6">
                <div className="flex justify-between items-start">
                  <span className="inline-block bg-warm-gold text-white px-3 py-1 text-xs font-medium tracking-wide">
                    {category}
                  </span>
                  
                  {session && (
                    <button
                      onClick={toggleFavorite}
                      className={cn(
                        "p-2 rounded-full",
                        favorited 
                          ? "bg-warm-gold text-white" 
                          : "bg-white/80 text-warm-gold hover:bg-white"
                      )}
                    >
                      <Heart className={cn("h-4 w-4", favorited ? "fill-white" : "")} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <DialogHeader className="text-left">
                  <DialogTitle className="text-3xl md:text-4xl font-bold text-white leading-tight tracking-tight">
                    {prompt.title}
                  </DialogTitle>
                  <p className="text-white/80 text-sm mt-2">{formatDate()}</p>
                </DialogHeader>
              </div>
            </div>
            
            {/* Content Section */}
            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <h3 className="text-xl font-bold mb-4 text-dark-base">Prompt Text</h3>
                  <div className="bg-white p-6 shadow-sm">
                    <p className="whitespace-pre-wrap text-dark-base/80 font-mono text-sm">
                      {prompt.prompt_text}
                    </p>
                  </div>
                  
                  <div className="mt-6">
                    <Button 
                      className="w-full py-6 bg-warm-gold hover:bg-warm-gold/90 text-white text-base rounded-none"
                      onClick={handleCopyClick}
                    >
                      {copied ? (
                        <>
                          <Check className="mr-2 h-5 w-5" />
                          Copied to Clipboard
                        </>
                      ) : (
                        <>
                          <Copy className="mr-2 h-5 w-5" />
                          Copy Prompt
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="lg:border-l lg:border-warm-gold/20 lg:pl-8">
                  <h3 className="text-lg font-bold text-dark-base mb-4">Details</h3>
                  <dl className="space-y-4">
                    {prompt.metadata?.category && (
                      <div>
                        <dt className="text-dark-base/60 text-sm font-medium uppercase tracking-wide mb-1">Category</dt>
                        <dd className="text-dark-base font-medium">{prompt.metadata.category}</dd>
                      </div>
                    )}
                    
                    {prompt.metadata?.style && (
                      <div>
                        <dt className="text-dark-base/60 text-sm font-medium uppercase tracking-wide mb-1">Style</dt>
                        <dd className="text-dark-base font-medium">{prompt.metadata.style}</dd>
                      </div>
                    )}
                    
                    {prompt.metadata?.target_model && (
                      <div>
                        <dt className="text-dark-base/60 text-sm font-medium uppercase tracking-wide mb-1">Model</dt>
                        <dd className="text-dark-base font-medium">{prompt.metadata.target_model}</dd>
                      </div>
                    )}
                    
                    {tags.length > 0 && (
                      <div>
                        <dt className="text-dark-base/60 text-sm font-medium uppercase tracking-wide mb-1">Tags</dt>
                        <dd className="flex flex-wrap gap-2 mt-1">
                          {tags.map(tag => (
                            <span 
                              key={tag} 
                              className="bg-warm-gold/10 text-warm-gold px-2 py-1 text-xs"
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
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default PromptDetailsDialog;


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

  const imagePath = prompt.prompt_type === "text" 
    ? prompt.default_image_path || 'textpromptdefaultimg.jpg'
    : prompt.image_path || prompt.image_url || null;

  useEffect(() => {
    if (open && imagePath) {
      async function loadImage() {
        try {
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

  // Get category color class
  const getCategoryClass = (category: string) => {
    switch (category.toLowerCase()) {
      case 'chatgpt':
        return 'bg-warm-gold';
      case 'midjourney':
        return 'bg-muted-teal';
      case 'workflow':
        return 'bg-workflow-purple';
      default:
        return 'bg-warm-gold';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 border-none bg-[#efeee9] rounded-2xl shadow-xl overflow-hidden">
        <DialogDescription id="prompt-details-description" className="sr-only">
          Details for prompt: {prompt.title}
        </DialogDescription>

        <ScrollArea className="max-h-[85vh]">
          <div className="p-8 space-y-6">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Image */}
              <div className="lg:w-80 flex-shrink-0">
                {dialogImgUrl && (
                  <div className="relative overflow-hidden rounded-xl bg-white/50 aspect-square">
                    <img
                      src={dialogImgUrl}
                      alt={prompt.title}
                      className="w-full h-full object-cover"
                      onLoad={() => setImageLoading(false)}
                      onError={() => setImageError(true)}
                    />
                  </div>
                )}
              </div>
              
              {/* Header Content */}
              <div className="flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    {/* Category Tag */}
                    <span
                      className={cn(
                        "inline-block rounded-lg text-white px-3 py-1 text-xs font-medium",
                        getCategoryClass(category)
                      )}
                    >
                      {category}
                    </span>
                    
                    {/* Title */}
                    <DialogHeader className="text-left p-0">
                      <DialogTitle className="text-3xl font-bold text-gray-900 leading-tight">
                        {prompt.title}
                      </DialogTitle>
                      <p className="text-gray-600 text-sm mt-2">{formatDate()}</p>
                    </DialogHeader>
                  </div>
                  
                  {/* Favorite Button */}
                  {session && (
                    <button
                      onClick={toggleFavorite}
                      className={cn(
                        "p-3 rounded-full transition-all duration-200",
                        "hover:bg-white/30",
                        favorited 
                          ? "text-[#c49d68]" 
                          : "text-gray-400 hover:text-[#c49d68]"
                      )}
                    >
                      <Heart className={cn("h-6 w-6", favorited && "fill-current")} />
                    </button>
                  )}
                </div>
                
                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {prompt.metadata?.target_model && (
                      <span className="px-3 py-1 bg-white/60 text-gray-700 text-sm rounded-lg border border-gray-200">
                        {prompt.metadata.target_model}
                      </span>
                    )}
                    {prompt.metadata?.use_case && (
                      <span className="px-3 py-1 bg-white/60 text-gray-700 text-sm rounded-lg border border-gray-200">
                        {prompt.metadata.use_case}
                      </span>
                    )}
                    {tags.slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-white/60 text-gray-700 text-sm rounded-lg border border-gray-200"
                      >
                        {tag}
                      </span>
                    ))}
                    {tags.length > 3 && (
                      <span className="px-3 py-1 bg-white/60 text-gray-500 text-sm rounded-lg border border-gray-200">
                        +{tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Prompt Text Section */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900">Prompt Text</h3>
              <div className="bg-white/60 p-6 rounded-xl border border-gray-200">
                <p className="whitespace-pre-wrap text-gray-800 font-mono text-sm leading-relaxed">
                  {prompt.prompt_text}
                </p>
              </div>
              
              {/* Copy Button */}
              <Button 
                className="w-full py-4 bg-[#c49d68] hover:bg-[#c49d68]/90 text-white text-base font-semibold rounded-xl shadow-md transition-all duration-200"
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default PromptDetailsDialog;

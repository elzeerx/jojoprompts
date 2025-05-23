
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Copy, CheckCircle } from "lucide-react";
import { type Prompt, type PromptRow } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getPromptImage, getTextPromptDefaultImage } from "@/utils/image";
import { cn } from "@/lib/utils";

interface PromptDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Prompt | PromptRow;
}

export function PromptDetailsDialog({ open, onOpenChange, prompt }: PromptDetailsDialogProps) {
  const { session } = useAuth();
  const [favorited, setFavorited] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('/img/placeholder.png');
  const [copied, setCopied] = useState(false);

  const { title, prompt_text, metadata, prompt_type } = prompt;
  const category = metadata?.category || "ChatGPT";
  const tags = metadata?.tags || [];
  const model = metadata?.target_model || category;
  const useCase = metadata?.use_case;

  useEffect(() => {
    async function loadImage() {
      try {
        let url;
        if (prompt_type === 'text' && (!prompt.image_path && !prompt.image_url)) {
          // For text prompts without custom images, use the default text prompt image
          url = await getTextPromptDefaultImage();
        } else {
          const imagePath = prompt.image_path || prompt.image_url;
          url = await getPromptImage(imagePath, 600, 85);
        }
        setImageUrl(url);
      } catch (error) {
        console.error('Error loading prompt image:', error);
        setImageUrl('/img/placeholder.png');
      }
    }
    loadImage();

    // Check if prompt is favorited by current user
    if (session) {
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
  }, [prompt.id, prompt.image_path, prompt.image_url, prompt_type, session]);

  const handleToggleFavorite = async () => {
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
      
      toast({
        title: favorited ? "Removed from favorites" : "Added to favorites",
        description: favorited ? "Prompt removed from your favorites" : "Prompt added to your favorites"
      });
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast({
        title: "Error",
        description: "Failed to update favorites",
        variant: "destructive"
      });
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt_text);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Prompt text has been copied to your clipboard"
      });
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast({
        title: "Error",
        description: "Failed to copy prompt to clipboard",
        variant: "destructive"
      });
    }
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'chatgpt':
        return '#c49d68';
      case 'midjourney':
        return '#7a9e9f';
      case 'workflow':
        return '#8b7fb8';
      default:
        return '#c49d68';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="prompt-dialog max-w-2xl">
        <div className="p-4 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <span 
                className="inline-block rounded-lg text-white px-3 py-1 text-xs font-medium mb-3"
                style={{ backgroundColor: getCategoryColor(category) }}
              >
                {category}
              </span>
              <div className="flex items-center gap-3">
                <DialogHeader className="text-left p-0 flex-1">
                  <DialogTitle className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                    {title}
                  </DialogTitle>
                </DialogHeader>
                {session && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleFavorite}
                    className={cn(
                      "h-10 w-10 rounded-full hover:bg-white/30",
                      favorited 
                        ? "text-[#c49d68]" 
                        : "text-gray-400 hover:text-[#c49d68]"
                    )}
                  >
                    <Heart className={cn("h-5 w-5", favorited && "fill-current")} />
                  </Button>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                May 05, 2025
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white/40 p-4 sm:p-6 rounded-xl border border-gray-200 space-y-6">
            {/* Image */}
            <div className="relative overflow-hidden rounded-xl h-48 sm:h-64 bg-white/50">
              <img
                src={imageUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-white/60 text-gray-700 border-gray-200">
                {model}
              </Badge>
              {useCase && (
                <Badge variant="secondary" className="bg-white/60 text-gray-700 border-gray-200">
                  {useCase}
                </Badge>
              )}
              {tags.slice(0, 4).map((tag, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="bg-white/60 text-gray-700 border-gray-200"
                >
                  {tag}
                </Badge>
              ))}
              {tags.length > 4 && (
                <Badge variant="secondary" className="bg-white/60 text-gray-500 border-gray-200">
                  +{tags.length - 4} more
                </Badge>
              )}
            </div>

            {/* Prompt Text Section */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Prompt Text</h3>
              <div className="bg-gray-50 p-4 rounded-lg border">
                <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {prompt_text}
                </p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-6">
            <Button
              onClick={handleCopyPrompt}
              className="w-full bg-[#c49d68] hover:bg-[#c49d68]/90 text-white font-semibold py-3 text-base rounded-xl shadow-md transition-all duration-200"
              disabled={copied}
            >
              {copied ? (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Copied!
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
      </DialogContent>
    </Dialog>
  );
}


import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Copy, CheckCircle, X, Play, Volume2 } from "lucide-react";
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
  const [imageUrl, setImageUrl] = useState<string>('/placeholder.svg');
  const [copied, setCopied] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [mediaPreviewOpen, setMediaPreviewOpen] = useState(false);

  const { title, prompt_text, metadata, prompt_type } = prompt;
  const category = metadata?.category || "ChatGPT";
  const tags = metadata?.tags || [];
  const model = metadata?.target_model || category;
  const useCase = metadata?.use_case;
  const mediaFiles = metadata?.media_files || [];

  // Get primary image for main display
  const primaryImage = mediaFiles.find(file => file.type === 'image') || null;
  const primaryImagePath = primaryImage?.path || prompt.image_path || prompt.image_url;

  useEffect(() => {
    async function loadImage() {
      try {
        let url;
        if (prompt_type === 'text' && (!primaryImagePath)) {
          url = await getTextPromptDefaultImage();
        } else {
          url = await getPromptImage(primaryImagePath, 600, 85);
        }
        setImageUrl(url);
      } catch (error) {
        console.error('Error loading prompt image:', error);
        setImageUrl('/placeholder.svg');
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
  }, [prompt.id, primaryImagePath, prompt_type, session]);

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

  const getMediaUrl = async (mediaPath: string) => {
    try {
      return await getPromptImage(mediaPath, 800, 90);
    } catch (error) {
      console.error('Error loading media:', error);
      return '/placeholder.svg';
    }
  };

  const handleMediaClick = (index: number) => {
    setSelectedMediaIndex(index);
    setMediaPreviewOpen(true);
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Play className="h-4 w-4" />;
      case 'audio':
        return <Volume2 className="h-4 w-4" />;
      default:
        return null;
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="prompt-dialog max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
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
                {/* Main Image */}
                <div 
                  className="relative overflow-hidden rounded-xl aspect-square bg-white/50 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => handleMediaClick(0)}
                >
                  <img
                    src={imageUrl}
                    alt={title}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
                    <span className="text-white text-sm font-medium bg-black/50 px-3 py-1 rounded-lg">
                      Click to expand
                    </span>
                  </div>
                </div>

                {/* Media Files Grid */}
                {mediaFiles.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Media Files ({mediaFiles.length})</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {mediaFiles.map((media, index) => (
                        <MediaThumbnail
                          key={index}
                          media={media}
                          index={index}
                          onClick={() => handleMediaClick(index)}
                        />
                      ))}
                    </div>
                  </div>
                )}

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

                {/* Prompt Text Section with constrained height and scrolling */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Prompt Text</h3>
                  <div className="bg-gray-50 p-4 rounded-lg border max-h-60 overflow-y-auto">
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Media Preview Dialog */}
      <MediaPreviewDialog
        open={mediaPreviewOpen}
        onOpenChange={setMediaPreviewOpen}
        mediaFiles={mediaFiles}
        selectedIndex={selectedMediaIndex}
        title={title}
      />
    </>
  );
}

// Media Thumbnail Component
function MediaThumbnail({ media, index, onClick }: { 
  media: { type: string; path: string; name: string }, 
  index: number, 
  onClick: () => void 
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState('/placeholder.svg');

  useEffect(() => {
    const loadThumbnail = async () => {
      try {
        const url = await getPromptImage(media.path, 200, 80);
        setThumbnailUrl(url);
      } catch (error) {
        console.error('Error loading thumbnail:', error);
      }
    };
    loadThumbnail();
  }, [media.path]);

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Play className="h-4 w-4" />;
      case 'audio':
        return <Volume2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div
      onClick={onClick}
      className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity group"
    >
      {media.type === 'image' ? (
        <img
          src={thumbnailUrl}
          alt={media.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-200">
          {getMediaIcon(media.type)}
          <span className="ml-2 text-xs text-gray-600 capitalize">{media.type}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
          {media.type}
        </span>
      </div>
    </div>
  );
}

// Media Preview Dialog Component
function MediaPreviewDialog({ 
  open, 
  onOpenChange, 
  mediaFiles, 
  selectedIndex, 
  title 
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaFiles: Array<{ type: string; path: string; name: string }>;
  selectedIndex: number;
  title: string;
}) {
  const [mediaUrl, setMediaUrl] = useState('');
  const selectedMedia = mediaFiles[selectedIndex];

  useEffect(() => {
    if (selectedMedia) {
      const loadMedia = async () => {
        try {
          const url = await getPromptImage(selectedMedia.path, 1200, 95);
          setMediaUrl(url);
        } catch (error) {
          console.error('Error loading media:', error);
          setMediaUrl('/placeholder.svg');
        }
      };
      loadMedia();
    }
  }, [selectedMedia]);

  if (!selectedMedia) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-black/95 border-none p-4">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="absolute -top-2 -right-2 z-10 text-white hover:bg-white/20 rounded-full"
          >
            <X className="h-6 w-6" />
          </Button>
          
          {selectedMedia.type === 'image' ? (
            <img
              src={mediaUrl}
              alt={selectedMedia.name}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          ) : selectedMedia.type === 'video' ? (
            <video
              src={mediaUrl}
              controls
              preload="metadata"
              muted
              playsInline
              className="w-full h-auto max-h-[80vh] rounded-lg"
              onError={(e) => {
                console.error('Video playback error:', e);
                toast({
                  title: "Video Error",
                  description: "There was an error loading the video",
                  variant: "destructive"
                });
              }}
            >
              Your browser does not support the video tag.
            </video>
          ) : selectedMedia.type === 'audio' ? (
            <div className="flex items-center justify-center min-h-[200px] bg-gray-800 rounded-lg">
              <audio
                src={mediaUrl}
                controls
                preload="metadata"
                className="w-full max-w-md"
                onError={(e) => {
                  console.error('Audio playback error:', e);
                  toast({
                    title: "Audio Error", 
                    description: "There was an error loading the audio",
                    variant: "destructive"
                  });
                }}
              >
                Your browser does not support the audio tag.
              </audio>
            </div>
          ) : null}
          
          <div className="mt-4 text-center">
            <p className="text-white text-sm">{selectedMedia.name}</p>
            <p className="text-gray-400 text-xs capitalize">{selectedMedia.type} file</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

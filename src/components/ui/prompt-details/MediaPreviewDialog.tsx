
import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { getPromptImage, getMediaUrl } from "@/utils/image";
import { toast } from "@/hooks/use-toast";
import { createLogger } from '@/utils/logging';

const logger = createLogger('MediaPreviewDialog');

interface MediaPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaFiles: Array<{ type: string; path: string; name: string }>;
  selectedIndex: number;
  title: string;
}

export function MediaPreviewDialog({ 
  open, 
  onOpenChange, 
  mediaFiles, 
  selectedIndex, 
  title 
}: MediaPreviewDialogProps) {
  const [mediaUrl, setMediaUrl] = useState('');
  const selectedMedia = mediaFiles[selectedIndex];

  useEffect(() => {
    if (selectedMedia) {
      const loadMedia = async () => {
        try {
          // Use the appropriate function based on media type
          let url;
          if (selectedMedia.type === 'video' || selectedMedia.type === 'audio') {
            url = await getMediaUrl(selectedMedia.path, selectedMedia.type as 'video' | 'audio');
          } else {
            // For images, use the original function with high quality
            url = await getPromptImage(selectedMedia.path, 1200, 95);
          }
          setMediaUrl(url);
          logger.debug('Media loaded successfully', { mediaType: selectedMedia.type, path: selectedMedia.path });
        } catch (error) {
          logger.error('Error loading media', { error: error instanceof Error ? error.message : error, mediaType: selectedMedia.type, path: selectedMedia.path });
          setMediaUrl('/placeholder.svg');
          toast({
            title: `${selectedMedia.type.charAt(0).toUpperCase() + selectedMedia.type.slice(1)} Error`,
            description: `There was an error loading the ${selectedMedia.type}`,
            variant: "destructive"
          });
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
                logger.error('Video playback error', { mediaName: selectedMedia.name });
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
                  logger.error('Audio playback error', { mediaName: selectedMedia.name });
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

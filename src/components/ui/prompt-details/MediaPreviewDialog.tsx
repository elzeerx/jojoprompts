
import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { getPromptImage, getMediaUrl } from "@/utils/image";
import { toast } from "@/hooks/use-toast";
import { useIsMobile, useIsSmallMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const isSmallMobile = useIsSmallMobile();

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
          console.log(`Loaded ${selectedMedia.type} URL: ${url}`);
        } catch (error) {
          console.error(`Error loading ${selectedMedia.type}:`, error);
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
      <DialogContent className={`
        bg-black/95 border-none mobile-optimize-rendering
        ${isMobile 
          ? 'max-w-[98vw] max-h-[98vh] w-full mx-1 my-1 p-2 sm:p-4' 
          : 'max-w-4xl p-4'
        }
      `}>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className={`
              absolute z-10 text-white hover:bg-white/20 rounded-full touch-manipulation
              ${isSmallMobile ? '-top-1 -right-1 h-10 w-10' : '-top-2 -right-2 h-12 w-12'}
            `}
          >
            <X className={isSmallMobile ? 'h-5 w-5' : 'h-6 w-6'} />
          </Button>
          
          {selectedMedia.type === 'image' ? (
            <img
              src={mediaUrl}
              alt={selectedMedia.name}
              className={`
                w-full h-auto object-contain rounded-lg
                ${isMobile ? 'max-h-[85vh]' : 'max-h-[80vh]'}
              `}
            />
          ) : selectedMedia.type === 'video' ? (
            <video
              src={mediaUrl}
              controls
              preload="metadata"
              muted
              playsInline
              className={`
                w-full h-auto rounded-lg
                ${isMobile ? 'max-h-[85vh]' : 'max-h-[80vh]'}
              `}
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
            <div className={`
              flex items-center justify-center bg-gray-800 rounded-lg
              ${isMobile ? 'min-h-[200px] p-4' : 'min-h-[200px]'}
            `}>
              <audio
                src={mediaUrl}
                controls
                preload="metadata"
                className={`
                  ${isMobile ? 'w-full max-w-full' : 'w-full max-w-md'}
                `}
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
          
          <div className={`mt-3 sm:mt-4 text-center ${isSmallMobile ? 'px-2' : ''}`}>
            <p className={`text-white font-medium ${isSmallMobile ? 'text-sm' : 'text-sm'}`}>
              {selectedMedia.name}
            </p>
            <p className={`text-gray-400 capitalize ${isSmallMobile ? 'text-xs' : 'text-xs'}`}>
              {selectedMedia.type} file
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

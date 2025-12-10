import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { type Prompt, type PromptRow } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { getPromptImage, getTextPromptDefaultImage } from '@/utils/image';
import { cn } from '@/lib/utils';
import { createLogger } from '@/utils/logging';

import { LeftColumn } from './components/LeftColumn';
import { RightColumn } from './components/RightColumn';
import { MediaPreviewDialog } from '../prompt-details/MediaPreviewDialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const logger = createLogger('ModernDetailModal');

interface ModernDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Prompt | PromptRow;
}

export function ModernDetailModal({ open, onOpenChange, prompt }: ModernDetailModalProps) {
  const { session } = useAuth();
  const [imageUrl, setImageUrl] = useState<string>('/placeholder.svg');
  const [mediaPreviewOpen, setMediaPreviewOpen] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  const { title, prompt_text, metadata, prompt_type } = prompt;
  const category = metadata?.category || 'ChatGPT';
  const tags = metadata?.tags || [];
  const mediaFiles = metadata?.media_files || [];
  const modelType = metadata?.model_type;
  const modelFields = metadata?.model_fields;

  // Get primary image path
  const primaryImage = mediaFiles.find((file: any) => file.type === 'image') || null;
  const primaryImagePath = primaryImage?.path || prompt.image_path || (prompt as any).image_url;

  // Check RTL based on content
  const isRTL = /[\u0600-\u06FF]/.test(title || '');

  useEffect(() => {
    async function loadImage() {
      try {
        let url;
        if (prompt_type === 'text' && !primaryImagePath) {
          url = await getTextPromptDefaultImage();
        } else {
          url = await getPromptImage(primaryImagePath, 600, 85);
        }
        setImageUrl(url);
      } catch (error) {
        logger.error('Error loading prompt image', { 
          error: error instanceof Error ? error.message : error, 
          imagePath: primaryImagePath, 
          promptId: prompt.id 
        });
        setImageUrl('/placeholder.svg');
      }
    }
    if (open) {
      loadImage();
    }
  }, [prompt.id, primaryImagePath, prompt_type, open]);

  const handleImageClick = () => {
    setSelectedMediaIndex(0);
    setMediaPreviewOpen(true);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 border-none bg-transparent max-w-5xl w-[95vw] max-h-[90vh]">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          
          {/* Modal Container */}
          <div className={cn(
            "relative w-full bg-white rounded-3xl shadow-2xl overflow-hidden",
            "flex flex-col md:flex-row max-h-[90vh]"
          )}>
            {/* Mobile Close Button */}
            <button
              onClick={handleClose}
              className={cn(
                "absolute top-4 z-20 p-2",
                "bg-white/80 backdrop-blur-sm rounded-full",
                "md:hidden",
                "min-h-[40px] min-w-[40px] flex items-center justify-center",
                "touch-manipulation shadow-sm",
                isRTL ? "right-4" : "left-4"
              )}
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {/* Left Column: Image + Info */}
            <LeftColumn
              imageUrl={imageUrl}
              title={title}
              description={prompt_text?.slice(0, 200) + (prompt_text?.length > 200 ? '...' : '')}
              tags={tags}
              category={category}
              onImageClick={handleImageClick}
              isRTL={isRTL}
            />

            {/* Right Column: Prompt + Config */}
            <RightColumn
              promptText={prompt_text}
              modelFields={modelFields}
              modelType={modelType}
              category={category}
              isRTL={isRTL}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Media Preview Dialog */}
      <MediaPreviewDialog
        open={mediaPreviewOpen}
        onOpenChange={setMediaPreviewOpen}
        mediaFiles={mediaFiles.length > 0 ? mediaFiles : [{ type: 'image', path: primaryImagePath || '', name: title }]}
        selectedIndex={selectedMediaIndex}
        title={title}
      />
    </>
  );
}

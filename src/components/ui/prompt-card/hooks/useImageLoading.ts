
import { useState, useEffect } from "react";
import { getPromptImage, getTextPromptDefaultImage } from "@/utils/image";
import { Prompt, PromptRow } from "@/types";
import { createLogger } from '@/utils/logging';

const logger = createLogger('useImageLoading');

export function useImageLoading(prompt: Prompt | PromptRow) {
  const { title, prompt_type, default_image_path, image_path, image_url, metadata } = prompt;
  const [imageUrl, setImageUrl] = useState<string>('/placeholder.svg');
  const mediaFiles = metadata?.media_files || [];

  useEffect(() => {
    async function loadImage() {
      try {
        let finalImageUrl = '/placeholder.svg';

        // Priority order: uploaded image_path -> media files -> default_image_path -> fallback
        const primaryImagePath = image_path || 
          mediaFiles.find((file: any) => file.type === 'image')?.path ||
          image_url;

        if (primaryImagePath) {
          finalImageUrl = await getPromptImage(primaryImagePath, 400, 85);
        } else if (prompt_type === 'text') {
          // Only use default image for text prompts if no uploaded image exists
          if (default_image_path) {
            finalImageUrl = await getPromptImage(default_image_path, 400, 85);
          } else {
            finalImageUrl = await getTextPromptDefaultImage();
          }
        }

        setImageUrl(finalImageUrl);
      } catch (error) {
        logger.error('Image loading error', { error: error instanceof Error ? error.message : error, promptType: prompt_type, imagePath: image_path });
        setImageUrl('/placeholder.svg');
      }
    }
    loadImage();
    // eslint-disable-next-line
  }, [image_path, default_image_path, image_url, prompt_type, title, mediaFiles.length]);

  return imageUrl;
}

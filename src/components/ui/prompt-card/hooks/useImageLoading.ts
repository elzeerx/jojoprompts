
import { useState, useEffect } from "react";
import { getPromptImage, getTextPromptDefaultImage } from "@/utils/image";
import { Prompt, PromptRow } from "@/types";

export function useImageLoading(prompt: Prompt | PromptRow) {
  const { title, prompt_type, default_image_path, image_path, image_url, metadata } = prompt;
  const [imageUrl, setImageUrl] = useState<string>('/placeholder.svg');
  const mediaFiles = metadata?.media_files || [];

  useEffect(() => {
    async function loadImage() {
      try {
        let finalImageUrl = '/placeholder.svg';

        if (prompt_type === 'text') {
          if (default_image_path) {
            finalImageUrl = await getPromptImage(default_image_path, 400, 85);
          } else {
            finalImageUrl = await getTextPromptDefaultImage();
          }
        } else {
          const primaryImagePath = mediaFiles.find((file: any) => file.type === 'image')?.path ||
            image_path || image_url;

          if (primaryImagePath) {
            finalImageUrl = await getPromptImage(primaryImagePath, 400, 85);
          }
        }

        setImageUrl(finalImageUrl);
      } catch (error) {
        setImageUrl('/placeholder.svg');
      }
    }
    loadImage();
    // eslint-disable-next-line
  }, [image_path, default_image_path, image_url, prompt_type, title, mediaFiles.length]);

  return imageUrl;
}

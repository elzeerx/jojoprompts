
import { useState, useEffect } from "react";
import { getPromptImage, getTextPromptDefaultImage } from "@/utils/image";

export function usePromptImage(prompt: any) {
  const [imageUrl, setImageUrl] = useState<string>('/img/placeholder.png');

  useEffect(() => {
    async function loadImage() {
      try {
        let url;
        if (prompt.prompt_type === 'text' && (!prompt.image_path && !prompt.image_url)) {
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
  }, [prompt.id, prompt.image_path, prompt.image_url, prompt.prompt_type]);

  return imageUrl;
}

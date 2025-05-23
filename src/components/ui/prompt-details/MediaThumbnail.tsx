
import { useState, useEffect } from "react";
import { Play, Volume2 } from "lucide-react";
import { getPromptImage } from "@/utils/image";

interface MediaThumbnailProps {
  media: { type: string; path: string; name: string };
  index: number;
  onClick: () => void;
}

export function MediaThumbnail({ media, index, onClick }: MediaThumbnailProps) {
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

import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ImageSectionProps {
  imageUrl: string;
  title: string;
  isAdmin?: boolean;
  onAdminClick?: (e: React.MouseEvent) => void;
}

export function ImageSection({ 
  imageUrl, 
  title, 
  isAdmin = false,
  onAdminClick 
}: ImageSectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleAdminClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdminClick?.(e);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoading(false);
    setHasError(true);
    e.currentTarget.src = '/placeholder.svg';
  };

  return (
    <div className="relative h-40 sm:h-48 w-full overflow-hidden bg-muted">
      {/* Skeleton loader */}
      {isLoading && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      )}
      
      <img
        src={imageUrl}
        alt={title}
        className={cn(
          "h-full w-full object-cover transition-all duration-500 group-hover:scale-105",
          isLoading && "opacity-0",
          !isLoading && "opacity-100"
        )}
        loading="lazy"
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      
      {/* Admin Menu Button - Top Left with hover reveal */}
      {isAdmin && (
        <button
          onClick={handleAdminClick}
          className={cn(
            "absolute top-3 left-3 p-2 rounded-full",
            "bg-white/80 backdrop-blur-sm",
            "text-gray-600 hover:bg-white hover:text-gray-900",
            "transition-all duration-200 shadow-sm",
            "opacity-0 group-hover:opacity-100",
            "min-h-[36px] min-w-[36px] flex items-center justify-center",
            "touch-manipulation"
          )}
          aria-label="Admin actions"
        >
          <MoreHorizontal size={18} />
        </button>
      )}
    </div>
  );
}

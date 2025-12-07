import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const handleAdminClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdminClick?.(e);
  };

  return (
    <div className="relative h-40 sm:h-48 w-full overflow-hidden bg-gray-100">
      <img
        src={imageUrl}
        alt={title}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.src = '/placeholder.svg';
        }}
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

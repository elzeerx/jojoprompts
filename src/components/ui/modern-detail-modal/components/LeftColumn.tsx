import React from 'react';
import { cn } from '@/lib/utils';

interface LeftColumnProps {
  imageUrl: string;
  title: string;
  description: string;
  tags?: string[];
  category?: string;
  onImageClick?: () => void;
  isRTL?: boolean;
}

export function LeftColumn({
  imageUrl,
  title,
  description,
  tags = [],
  category,
  onImageClick,
  isRTL = false
}: LeftColumnProps) {
  return (
    <div className={cn(
      "w-full md:w-5/12",
      "bg-gray-50 p-4 sm:p-6 md:p-8",
      "flex flex-col",
      "border-b md:border-b-0 md:border-l border-gray-100",
      "overflow-y-auto",
      isRTL && "md:border-l-0 md:border-r"
    )}>
      {/* Square Aspect Image */}
      <div 
        className="aspect-square w-full rounded-2xl overflow-hidden shadow-sm mb-4 sm:mb-6 bg-white cursor-pointer hover:opacity-90 transition-opacity"
        onClick={onImageClick}
      >
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = '/placeholder.svg';
          }}
        />
      </div>

      {/* Title */}
      <h1 className={cn(
        "text-2xl sm:text-3xl font-bold text-gray-900 mb-2",
        isRTL && "text-right"
      )}>
        {title}
      </h1>

      {/* Description */}
      <p className={cn(
        "text-gray-500 leading-relaxed mb-4 sm:mb-6 line-clamp-4",
        isRTL && "text-right"
      )}>
        {description}
      </p>

      {/* Tags at Bottom */}
      <div className="flex flex-wrap gap-2 mt-auto">
        {category && (
          <span className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg text-gray-600">
            {category}
          </span>
        )}
        {tags.slice(0, 4).map((tag, index) => (
          <span
            key={index}
            className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg text-gray-600"
          >
            {tag}
          </span>
        ))}
        {tags.length > 4 && (
          <span className="px-3 py-1.5 text-sm text-gray-400">
            +{tags.length - 4} more
          </span>
        )}
      </div>
    </div>
  );
}

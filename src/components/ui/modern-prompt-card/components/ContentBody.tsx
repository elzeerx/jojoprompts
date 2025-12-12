import React from 'react';
import { getTagPillStyle, getCategoryPillStyle } from '../utils/tagColors';
import { cn } from '@/lib/utils';

interface ContentBodyProps {
  title: string;
  description: string;
  category?: string;
  tags?: string[];
  modelType?: string;
  isLocked?: boolean;
}

export function ContentBody({
  title,
  description,
  category,
  tags = [],
  modelType,
  isLocked = false
}: ContentBodyProps) {
  // Get display tags (limit to 2 for card view)
  const displayTags = tags.slice(0, 2);
  
  return (
    <div className={cn(
      "flex flex-col flex-1 p-4 sm:p-5",
      isLocked && "opacity-60"
    )}>
      {/* Title and Description */}
      <div className="flex-1">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 leading-tight line-clamp-1">
          {title}
        </h3>
        <p className={cn(
          "text-sm line-clamp-2 leading-relaxed",
          isLocked ? "text-gray-400 italic" : "text-gray-500"
        )}>
          {isLocked ? "🔒 Premium content - upgrade to view" : description}
        </p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mt-3 sm:mt-4">
        {/* Category/Model Type Tag */}
        {(modelType || category) && (
          <span className={cn(
            "px-3 py-1 text-xs font-medium rounded-full",
            getCategoryPillStyle(modelType || category || '')
          )}>
            {modelType?.replace(/-/g, ' ') || category}
          </span>
        )}
        
        {/* Additional Tags */}
        {displayTags.map((tag, index) => (
          <span
            key={index}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-full",
              getTagPillStyle(tag)
            )}
          >
            {tag}
          </span>
        ))}
        
        {/* More tags indicator */}
        {tags.length > 2 && (
          <span className="px-2 py-1 text-xs text-gray-400">
            +{tags.length - 2}
          </span>
        )}
      </div>
    </div>
  );
}

import React from "react";
import { Heart, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryBadgeStyle, getPlatformIcon, getPlatformName, getModelBadgeStyle } from "../utils/categoryUtils.tsx";

export function CardHeader({ 
  category, 
  isN8nWorkflow, 
  favorited, 
  toggleFavorite, 
  session, 
  isSmallMobile,
  modelType
}: {
  category: string;
  isN8nWorkflow?: boolean;
  favorited: boolean;
  toggleFavorite: (e: React.MouseEvent) => void;
  session: any;
  isSmallMobile?: boolean;
  modelType?: string;
}) {
  const platformName = getPlatformName(modelType);
  const platformIcon = getPlatformIcon(modelType, "h-3 w-3");

  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
        {/* Platform Badge - show if model type is available */}
        {platformName && (
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg border",
            getModelBadgeStyle(modelType)
          )}>
            {platformIcon}
            <span className={isSmallMobile && platformName.length > 6 ? 'hidden' : ''}>
              {platformName}
            </span>
          </span>
        )}
        
        {/* Category Badge */}
        <span className={cn(
          "inline-block px-2 py-1 text-xs font-medium rounded-lg",
          getCategoryBadgeStyle(category)
        )}>
          {isSmallMobile && category.length > 8 ? category.substring(0, 8) + '...' : category}
        </span>
        
        {isN8nWorkflow && (
          <Workflow className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
        )}
      </div>
      {session && (
        <button
          onClick={toggleFavorite}
          className={cn(
            "p-2 rounded-full transition-all duration-200 flex items-center justify-center min-w-[44px] min-h-[44px]",
            "hover:bg-white/30 active:bg-white/50", 
            favorited 
              ? "text-[#c49d68]" 
              : "text-gray-400 hover:text-[#c49d68]"
          )}
        >
          <Heart className={cn("h-4 w-4", favorited && "fill-current")} />
        </button>
      )}
    </div>
  );
}

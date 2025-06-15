import React from "react";
import { Heart, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryBadgeStyle } from "../utils/categoryUtils.tsx";
import { useAuth } from "@/contexts/AuthContext";

export function CardHeader({ 
  category, 
  isN8nWorkflow, 
  favorited, 
  toggleFavorite, 
  session, 
  isSmallMobile 
}: {
  category: string;
  isN8nWorkflow?: boolean;
  favorited: boolean;
  toggleFavorite: (e: React.MouseEvent) => void;
  session: any;
  isSmallMobile?: boolean;
}) {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-1 sm:gap-2">
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

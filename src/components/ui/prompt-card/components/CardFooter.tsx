
import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import { getCategoryTheme } from "../utils/categoryUtils";

export function CardFooter({
  tags,
  isSmallMobile,
  isLocked,
  isAdmin,
  onEdit,
  onDelete,
  promptId,
  isN8nWorkflow,
  uploaderName,
  category
}: {
  tags: string[];
  isSmallMobile: boolean;
  isLocked: boolean;
  isAdmin: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  promptId: string;
  isN8nWorkflow: boolean;
  uploaderName?: string;
  category: string;
}) {
  const theme = getCategoryTheme(category);
  return (
    <>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, isSmallMobile ? 2 : 3).map((tag, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-background/80 backdrop-blur-sm text-foreground text-xs rounded-md border border-border/50 hover:border-border transition-colors"
            >
              {isSmallMobile && tag.length > 8 ? tag.substring(0, 8) + '...' : tag}
            </span>
          ))}
          {tags.length > (isSmallMobile ? 2 : 3) && (
            <span className="px-2 py-1 bg-muted/80 text-muted-foreground text-xs rounded-md border border-border/50">
              +{tags.length - (isSmallMobile ? 2 : 3)} more
            </span>
          )}
        </div>
      )}
      
      {/* Uploader info */}
      {uploaderName && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
          <User className="h-3 w-3" />
          <span>by @{uploaderName}</span>
        </div>
      )}
      
      {/* Action buttons */}
      <div className="mt-auto pt-2 space-y-2 flex-shrink-0">
        {!isLocked && (
          <Button
            className={cn(
              "w-full text-white font-semibold rounded-xl shadow-md transition-all duration-200 border-0",
              isSmallMobile ? "py-2 text-xs" : "py-3 text-sm sm:text-base"
            )}
            style={{ backgroundColor: theme.color }}
          >
            {isN8nWorkflow ? "View Workflow" : "View Details"}
          </Button>
        )}

        {isAdmin && (
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-gray-300 hover:bg-gray-50 text-xs"
              onClick={e => {
                e.stopPropagation();
                if (onEdit) onEdit(promptId);
              }}
            >
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 text-xs"
              onClick={e => {
                e.stopPropagation();
                if (onDelete) onDelete(promptId);
              }}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

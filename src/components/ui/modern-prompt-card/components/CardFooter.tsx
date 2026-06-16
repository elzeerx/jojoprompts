import React from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CopyButton } from '@/components/ui/copy-button';

interface CardFooterProps {
  uploaderName?: string;
  uploaderUsername?: string;
  avatarUrl?: string;
  favorited?: boolean;
  favoriteCount?: number;
  onFavoriteClick?: (e: React.MouseEvent) => void;
  isLocked?: boolean;
  promptText?: string;
  promptTitle?: string;
}

export function CardFooter({
  uploaderName,
  uploaderUsername,
  avatarUrl,
  favorited = false,
  favoriteCount = 0,
  onFavoriteClick,
  isLocked = false,
  promptText,
  promptTitle,
}: CardFooterProps) {
  // Generate avatar URL from dicebear if not provided
  const displayName = uploaderUsername || uploaderName || 'User';
  const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`;
  const avatar = avatarUrl || defaultAvatar;

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLocked) {
      onFavoriteClick?.(e);
    }
  };

  return (
    <div className={cn(
      "flex items-center justify-between px-4 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4",
      "border-t border-gray-50"
    )}>
      {/* User Info */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
          <img
            src={avatar}
            alt={displayName}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = defaultAvatar;
            }}
          />
        </div>
        <span className="text-xs font-medium text-gray-400 truncate max-w-[100px]">
          @{uploaderUsername || displayName}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {!isLocked && promptText && (
          <CopyButton
            value={promptText}
            variant="ghost"
            size="sm"
            showLabel={false}
            className="h-9 w-9 p-0 text-gray-400 hover:text-warm-gold"
            successDescription={
              promptTitle ? `"${promptTitle}" copied to clipboard` : "Prompt copied to clipboard"
            }
          />
        )}

        <button
          onClick={handleFavoriteClick}
          disabled={isLocked}
          className={cn(
            "flex items-center gap-1 transition-colors duration-200",
            "min-h-[36px] min-w-[36px] justify-center px-2 rounded-md",
            "touch-manipulation",
            favorited
              ? "text-red-500"
              : "text-gray-400 group-hover:text-red-500",
            isLocked && "cursor-not-allowed opacity-50"
          )}
          aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart
            size={16}
            className={cn(favorited && "fill-current")}
          />
          {favoriteCount > 0 && (
            <span className="text-xs font-medium">{favoriteCount}</span>
          )}
        </button>
      </div>
    </div>
  );
}

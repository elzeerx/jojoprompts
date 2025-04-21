
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function CardActions({
  favorited,
  onToggleFavorite,
  isSelectable,
  isSelected,
  onSelect,
  showHeart = true,
  className = ""
}: {
  favorited: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (checked: boolean) => void;
  showHeart?: boolean;
  className?: string;
}) {
  const { session } = useAuth();

  return (
    <div className={cn(
      "flex items-center justify-between w-full px-2",
      "absolute top-3 left-0 z-10",
      className
    )}>
      {isSelectable && (
        <div className="backdrop-blur bg-black/30 rounded-full p-1">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            className="h-5 w-5 border-2 border-white bg-white/40"
          />
        </div>
      )}
      <div className="ml-auto">
        {showHeart && session && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full backdrop-blur bg-black/30",
              favorited && "text-red-500 hover:text-red-600",
              "hover:bg-black/40 transition-colors"
            )}
            tabIndex={0}
            onClick={onToggleFavorite}
            onKeyDown={e => e.stopPropagation()}
          >
            <Heart className={cn("h-5 w-5", favorited && "fill-current")} />
          </Button>
        )}
      </div>
    </div>
  );
}


import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function CardActions({
  favorited,
  onToggleFavorite,
  showHeart = true,
  className = ""
}: {
  favorited: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  showHeart?: boolean;
  className?: string;
}) {
  const { session } = useAuth();

  return (
    <div className={cn(
      "flex items-center justify-end w-full px-2",
      "absolute top-3 left-0 z-10",
      className
    )}>
      {/* Only show Heart for authenticated users */}
      <div>
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

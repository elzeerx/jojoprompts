
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptHeaderProps {
  category: string;
  title: string;
  favorited: boolean;
  onToggleFavorite: () => void;
  session: any;
}

export function PromptHeader({ category, title, favorited, onToggleFavorite, session }: PromptHeaderProps) {
  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'chatgpt':
        return '#c49d68';
      case 'midjourney':
        return '#7a9e9f';
      case 'workflow':
        return '#8b7fb8';
      default:
        return '#c49d68';
    }
  };

  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex-1">
        <span 
          className="inline-block rounded-lg text-white px-3 py-1 text-xs font-medium mb-3"
          style={{ backgroundColor: getCategoryColor(category) }}
        >
          {category}
        </span>
        <div className="flex items-center gap-3">
          <DialogHeader className="text-left p-0 flex-1">
            <DialogTitle className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
              {title}
            </DialogTitle>
          </DialogHeader>
          {session && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFavorite}
              className={cn(
                "h-10 w-10 rounded-full hover:bg-white/30",
                favorited 
                  ? "text-[#c49d68]" 
                  : "text-gray-400 hover:text-[#c49d68]"
              )}
            >
              <Heart className={cn("h-5 w-5", favorited && "fill-current")} />
            </Button>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          May 05, 2025
        </p>
      </div>
    </div>
  );
}

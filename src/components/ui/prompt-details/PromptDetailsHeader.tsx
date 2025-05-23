
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heart, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptDetailsHeaderProps {
  title: string;
  category: string;
  isN8nWorkflow: boolean;
  session: any;
  favorited: boolean;
  onToggleFavorite: () => void;
  getCategoryColor: (category: string) => string;
}

export function PromptDetailsHeader({
  title,
  category,
  isN8nWorkflow,
  session,
  favorited,
  onToggleFavorite,
  getCategoryColor
}: PromptDetailsHeaderProps) {
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
            <DialogTitle className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight flex items-center gap-2">
              {title}
              {isN8nWorkflow && (
                <Workflow className="h-6 w-6 text-blue-600" />
              )}
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


import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileImage, MessageSquare, GalleryVertical, ImagePlus } from "lucide-react";

interface PromptTypeMenuProps {
  onSelect: (type: "text" | "image" | "image-selection" | "workflow", category: string) => void;
  trigger: React.ReactNode;
}

export function PromptTypeMenu({ onSelect, trigger }: PromptTypeMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-72 rounded-xl border-border shadow-lg" align="end">
        <div className="grid gap-4">
          <div>
            <h3 className="font-medium text-sm mb-2 text-warm-gold">ChatGPT</h3>
            <div className="grid gap-1">
              <Button
                variant="ghost"
                className="flex items-center justify-start gap-2 hover:bg-warm-gold/10 transition-all"
                onClick={() => onSelect("text", "ChatGPT")}
              >
                <MessageSquare className="h-5 w-5 text-warm-gold" />
                <span>Add Text Prompt</span>
              </Button>
              <Button
                variant="ghost"
                className="flex items-center justify-start gap-2 hover:bg-warm-gold/10 transition-all"
                onClick={() => onSelect("image", "ChatGPT")}
              >
                <FileImage className="h-5 w-5 text-warm-gold" />
                <span>Add Image Prompt</span>
              </Button>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-sm mb-2 text-muted-teal">Midjourney</h3>
            <div className="grid gap-1">
              <Button
                variant="ghost"
                className="flex items-center justify-start gap-2 hover:bg-muted-teal/10 transition-all"
                onClick={() => onSelect("image-selection", "Midjourney")}
              >
                <GalleryVertical className="h-5 w-5 text-muted-teal" />
                <span>Add Image Selection</span>
              </Button>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-sm mb-2 text-secondary">n8n</h3>
            <div className="grid gap-1">
              <Button
                variant="ghost"
                className="flex items-center justify-start gap-2 hover:bg-secondary/10 transition-all"
                onClick={() => onSelect("workflow", "n8n")}
              >
                <ImagePlus className="h-5 w-5 text-secondary" />
                <span>Add Workflow</span>
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}


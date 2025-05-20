
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileImage, MessageSquare, MousePointer, ImagePlus, GalleryVertical } from "lucide-react";

interface PromptTypeMenuProps {
  onSelect: (type: "text" | "image" | "button" | "image-selection" | "workflow", category: string) => void;
  trigger: React.ReactNode;
}

export function PromptTypeMenu({ onSelect, trigger }: PromptTypeMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="grid gap-4">
          <div>
            <h3 className="font-medium text-sm mb-2 text-muted-foreground">ChatGPT</h3>
            <div className="grid gap-1">
              <Button
                variant="ghost"
                className="flex items-center justify-start gap-2"
                onClick={() => onSelect("text", "ChatGPT")}
              >
                <MessageSquare className="h-5 w-5" />
                Add Text Prompt
              </Button>
              <Button
                variant="ghost"
                className="flex items-center justify-start gap-2"
                onClick={() => onSelect("image", "ChatGPT")}
              >
                <FileImage className="h-5 w-5" />
                Add Image Prompt
              </Button>
              <Button
                variant="ghost"
                className="flex items-center justify-start gap-2"
                onClick={() => onSelect("button", "ChatGPT")}
              >
                <MousePointer className="h-5 w-5" />
                Add Button Prompt
              </Button>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-sm mb-2 text-muted-foreground">Midjourney</h3>
            <div className="grid gap-1">
              <Button
                variant="ghost"
                className="flex items-center justify-start gap-2"
                onClick={() => onSelect("image-selection", "Midjourney")}
              >
                <GalleryVertical className="h-5 w-5" />
                Add Image Selection
              </Button>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-sm mb-2 text-muted-foreground">n8n</h3>
            <div className="grid gap-1">
              <Button
                variant="ghost"
                className="flex items-center justify-start gap-2"
                onClick={() => onSelect("workflow", "n8n")}
              >
                <ImagePlus className="h-5 w-5" />
                Add Workflow
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

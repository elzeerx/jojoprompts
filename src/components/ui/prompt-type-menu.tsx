
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileImage, MessageSquare } from "lucide-react";

interface PromptTypeMenuProps {
  onSelect: (type: "text" | "image") => void;
  trigger: React.ReactNode;
}

export function PromptTypeMenu({ onSelect, trigger }: PromptTypeMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="grid gap-2">
          <Button
            variant="ghost"
            className="flex items-center justify-start gap-2"
            onClick={() => onSelect("image")}
          >
            <FileImage className="h-5 w-5" />
            Add Image Prompt
          </Button>
          <Button
            variant="ghost"
            className="flex items-center justify-start gap-2"
            onClick={() => onSelect("text")}
          >
            <MessageSquare className="h-5 w-5" />
            Add Text Prompt
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}


import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type PromptRow } from "@/types";
import { getCdnUrl } from "@/utils/image";
import { useEffect } from "react";

interface PromptDetailsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prompt: PromptRow | null;
  promptList?: PromptRow[];
}

export function PromptDetailsDialog({
  open,
  onOpenChange,
  prompt,
  promptList = [],
}: PromptDetailsDialogProps) {
  if (!prompt) return null;
  const image = getCdnUrl(prompt.image_path, 1200, 90);

  // Close dialog if the prompt is deleted
  useEffect(() => {
    if (promptList.length > 0 && !promptList.find(p => p.id === prompt.id)) {
      onOpenChange(false);
    }
  }, [promptList, prompt.id, onOpenChange]);

  // Open image in new tab/lightbox
  const openFullImage = () => {
    if (image) window.open(image, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <ScrollArea className="h-full max-h-[85vh]">
          <div className="p-6 flex flex-col space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tight">
                {prompt.title}
              </DialogTitle>
            </DialogHeader>

            {prompt.image_path && (
              <div className="rounded-xl overflow-hidden max-w-full mx-auto flex flex-col items-center">
                <img
                  src={image!}
                  alt={prompt.title}
                  loading="lazy"
                  className="block max-w-full h-auto max-h-[80vh] cursor-zoom-in transition-shadow duration-300"
                  style={{ objectFit: "contain" }}
                  onClick={openFullImage}
                  title="Click to enlarge"
                />
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-2">Prompt Text</h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{prompt.prompt_text}</p>
              </div>
            </div>

            {(prompt.metadata?.category ||
              prompt.metadata?.style ||
              prompt.metadata?.tags?.length > 0) && (
              <div>
                <h3 className="text-sm font-medium mb-3">Details</h3>
                <div className="flex flex-wrap gap-2">
                  {prompt.metadata?.category && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                      {prompt.metadata.category}
                    </Badge>
                  )}
                  {prompt.metadata?.style && (
                    <Badge variant="secondary" className="bg-secondary/30 hover:bg-secondary/40">
                      {prompt.metadata.style}
                    </Badge>
                  )}
                  {prompt.metadata?.tags?.map(tag => (
                    <Badge key={tag} variant="outline" className="hover:bg-accent">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default PromptDetailsDialog;

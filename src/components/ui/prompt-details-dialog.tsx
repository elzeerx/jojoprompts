
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { type PromptRow } from "@/types";

interface PromptDetailsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prompt: PromptRow | null;
}

export function PromptDetailsDialog({ open, onOpenChange, prompt }: PromptDetailsDialogProps) {
  if (!prompt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{prompt.title}</DialogTitle>
        </DialogHeader>

        {prompt.image_url && (
          <img 
            src={prompt.image_url} 
            alt={prompt.title} 
            className="w-full rounded-lg mb-4 aspect-video object-cover"
          />
        )}

        <p className="whitespace-pre-wrap mb-4">{prompt.prompt_text}</p>

        <div className="flex flex-wrap gap-2 text-sm">
          {prompt.metadata?.category && (
            <Badge variant="secondary">{prompt.metadata.category}</Badge>
          )}
          {prompt.metadata?.style && (
            <Badge variant="secondary">{prompt.metadata.style}</Badge>
          )}
          {prompt.metadata?.tags?.map((tag) => (
            <Badge key={tag} variant="outline">{tag}</Badge>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PromptDetailsDialog;

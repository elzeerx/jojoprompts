
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { type Prompt, type PromptRow } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePromptImage } from "./prompt-details-dialog/hooks/usePromptImage";
import { useFavoriteStatus } from "./prompt-details-dialog/hooks/useFavoriteStatus";
import { useCopyPrompt } from "./prompt-details-dialog/hooks/useCopyPrompt";
import { PromptHeader } from "./prompt-details-dialog/components/PromptHeader";
import { PromptImage } from "./prompt-details-dialog/components/PromptImage";
import { PromptTags } from "./prompt-details-dialog/components/PromptTags";
import { PromptTextSection } from "./prompt-details-dialog/components/PromptTextSection";
import { CopyButton } from "./prompt-details-dialog/components/CopyButton";
import { ImagePreviewDialog } from "./prompt-details-dialog/components/ImagePreviewDialog";

interface PromptDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Prompt | PromptRow;
}

export function PromptDetailsDialog({ open, onOpenChange, prompt }: PromptDetailsDialogProps) {
  const { session } = useAuth();
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  const { title, prompt_text, metadata, prompt_type } = prompt;
  const category = metadata?.category || "ChatGPT";
  const tags = metadata?.tags || [];
  const model = metadata?.target_model || category;
  const useCase = metadata?.use_case;

  const imageUrl = usePromptImage(prompt);
  const { favorited, handleToggleFavorite } = useFavoriteStatus(prompt.id, session);
  const { copied, handleCopyPrompt } = useCopyPrompt();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="prompt-dialog max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-8">
              <PromptHeader
                category={category}
                title={title}
                favorited={favorited}
                onToggleFavorite={handleToggleFavorite}
                session={session}
              />

              <div className="bg-white/40 p-4 sm:p-6 rounded-xl border border-gray-200 space-y-6">
                <PromptImage
                  imageUrl={imageUrl}
                  title={title}
                  onImageClick={() => setImagePreviewOpen(true)}
                />

                <PromptTags
                  model={model}
                  useCase={useCase}
                  tags={tags}
                />

                <PromptTextSection promptText={prompt_text} />
              </div>

              <CopyButton
                copied={copied}
                onCopy={() => handleCopyPrompt(prompt_text)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImagePreviewDialog
        open={imagePreviewOpen}
        onOpenChange={setImagePreviewOpen}
        imageUrl={imageUrl}
        title={title}
      />
    </>
  );
}

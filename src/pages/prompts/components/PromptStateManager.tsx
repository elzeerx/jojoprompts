
import { useState } from "react";
import { type Prompt, type PromptRow } from "@/types";
import { PromptDetailsDialog } from "@/components/ui/prompt-details-dialog";

interface PromptStateManagerProps {
  prompts: PromptRow[];
  children: (props: {
    selectedPrompt: PromptRow | null;
    setSelectedPrompt: (prompt: PromptRow | null) => void;
    detailsDialogOpen: boolean;
    setDetailsDialogOpen: (open: boolean) => void;
  }) => React.ReactNode;
}

export function PromptStateManager({ prompts, children }: PromptStateManagerProps) {
  const [selectedPrompt, setSelectedPrompt] = useState<PromptRow | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  return (
    <>
      {children({
        selectedPrompt,
        setSelectedPrompt,
        detailsDialogOpen,
        setDetailsDialogOpen,
      })}

      {selectedPrompt && (
        <PromptDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          prompt={selectedPrompt}
          promptList={prompts as PromptRow[]}
        />
      )}
    </>
  );
}

import { DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PromptDialogHeaderProps {
  isEditing?: boolean;
}

export function PromptDialogHeader({ isEditing }: PromptDialogHeaderProps) {
  return (
    <div className="flex-shrink-0 p-6 border-b border-gray-200">
      <span 
        className="inline-block rounded-lg text-white px-3 py-1 text-xs font-medium mb-3"
        style={{ backgroundColor: '#c49d68' }}
      >
        Prompt
      </span>
      <DialogHeader className="text-left p-0">
        <DialogTitle className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
          {isEditing ? "Edit Prompt" : "Create New Prompt"}
        </DialogTitle>
      </DialogHeader>
    </div>
  );
}

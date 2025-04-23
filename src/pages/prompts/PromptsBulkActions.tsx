import { Button } from "@/components/ui/button";

interface PromptsBulkActionsProps {
  selectedPromptsLength: number;
  totalFiltered: number;
  onSelectAll: () => void;
  // onExportPDF removed
}

export function PromptsBulkActions({
  selectedPromptsLength,
  totalFiltered,
  onSelectAll,
  // onExportPDF removed
}: PromptsBulkActionsProps) {
  const allSelected = selectedPromptsLength === totalFiltered && totalFiltered > 0;
  return (
    <div className="flex items-center justify-between p-3 mb-4 bg-secondary rounded-md">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onSelectAll}>
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {selectedPromptsLength} {selectedPromptsLength === 1 ? "prompt" : "prompts"} selected
        </span>
      </div>
      {/* Export as PDF removed */}
    </div>
  );
}

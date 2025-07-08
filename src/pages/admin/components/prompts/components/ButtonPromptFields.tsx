
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { type PromptRow } from "@/types";

interface ButtonPromptFieldsProps {
  metadata: PromptRow["metadata"];
  onMetadataChange: (metadata: PromptRow["metadata"]) => void;
}

export const ButtonPromptFields = ({ metadata, onMetadataChange }: ButtonPromptFieldsProps) => {
  return (
    <>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="button_text" className="text-right">
          Button Text
        </Label>
        <Input
          id="button_text"
          value={metadata.button_text || ""}
          onChange={(e) => onMetadataChange({ ...metadata, button_text: e.target.value })}
          className="col-span-3 rounded-lg"
          placeholder="Click me"
        />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="button_action" className="text-right">
          Button Action
        </Label>
        <Input
          id="button_action"
          value={metadata.button_action || ""}
          onChange={(e) => onMetadataChange({ ...metadata, button_action: e.target.value })}
          className="col-span-3 rounded-lg"
          placeholder="e.g., API endpoint or function name"
        />
      </div>
    </>
  );
};

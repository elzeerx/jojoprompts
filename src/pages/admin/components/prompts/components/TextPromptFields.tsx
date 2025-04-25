
import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PromptFormField } from "./PromptFormField";
import { type PromptRow } from "@/types";

interface TextPromptFieldsProps {
  metadata: PromptRow["metadata"];
  onMetadataChange: (metadata: PromptRow["metadata"]) => void;
}

export const TextPromptFields: React.FC<TextPromptFieldsProps> = ({
  metadata,
  onMetadataChange,
}) => {
  return (
    <>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="target_model" className="text-right">
          Target Model
        </Label>
        <Select
          value={metadata.target_model}
          onValueChange={(value) =>
            onMetadataChange({ ...metadata, target_model: value })
          }
        >
          <SelectTrigger className="col-span-3">
            <SelectValue placeholder="Select target model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
            <SelectItem value="gpt-4.5-preview">GPT-4.5 Preview</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <PromptFormField
        id="use_case"
        label="Use Case"
        value={metadata.use_case || ""}
        onChange={(value) => onMetadataChange({ ...metadata, use_case: value })}
        placeholder="e.g., Writing Assistant, Code Helper"
      />
    </>
  );
};

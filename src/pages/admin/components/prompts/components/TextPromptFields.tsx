
import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UseCaseField } from "./UseCaseField";
import { type PromptRow } from "@/types";

interface TextPromptFieldsProps {
  metadata: PromptRow["metadata"];
  onMetadataChange: (metadata: PromptRow["metadata"]) => void;
  promptText: string;
}

export const TextPromptFields: React.FC<TextPromptFieldsProps> = ({
  metadata,
  onMetadataChange,
  promptText,
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
            <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
            <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
            <SelectItem value="gpt-4.1-nano">GPT-4.1 Nano</SelectItem>
            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
            <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
            <SelectItem value="o3">OpenAI o3</SelectItem>
            <SelectItem value="o4-mini">OpenAI o4-mini</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <UseCaseField
        value={metadata.use_case || ""}
        onChange={(value) => onMetadataChange({ ...metadata, use_case: value })}
        promptText={promptText}
      />
    </>
  );
};

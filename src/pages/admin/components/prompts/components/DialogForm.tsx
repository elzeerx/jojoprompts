
import { PromptFormField } from "./PromptFormField";
import { TextPromptFields } from "./TextPromptFields";
import { ImageUploadField } from "./ImageUploadField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type PromptRow } from "@/types";

interface DialogFormProps {
  title: string;
  promptText: string;
  metadata: PromptRow["metadata"];
  promptType: "text" | "image";
  imageURL: string;
  file: File | null;
  onTitleChange: (value: string) => void;
  onPromptTextChange: (value: string) => void;
  onMetadataChange: (metadata: PromptRow["metadata"]) => void;
  onFileChange: (file: File | null) => void;
}

export const DialogForm = ({
  title,
  promptText,
  metadata,
  promptType,
  imageURL,
  file,
  onTitleChange,
  onPromptTextChange,
  onMetadataChange,
  onFileChange,
}: DialogFormProps) => {
  return (
    <div className="grid gap-4 py-4">
      <PromptFormField
        id="title"
        label="Title"
        value={title}
        onChange={onTitleChange}
      />
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="prompt_text" className="text-right">
          Prompt Text
        </Label>
        <Textarea
          id="prompt_text"
          value={promptText}
          onChange={(e) => onPromptTextChange(e.target.value)}
          className="col-span-3"
        />
      </div>

      {promptType === "image" ? (
        <ImageUploadField
          imageURL={imageURL}
          file={file}
          onFileChange={onFileChange}
        />
      ) : (
        <TextPromptFields
          metadata={metadata}
          onMetadataChange={onMetadataChange}
        />
      )}

      <PromptFormField
        id="category"
        label="Category"
        value={metadata.category || ""}
        onChange={(value) => onMetadataChange({ ...metadata, category: value })}
      />

      {promptType === "image" && (
        <PromptFormField
          id="style"
          label="Style"
          value={metadata.style || ""}
          onChange={(value) => onMetadataChange({ ...metadata, style: value })}
        />
      )}

      <PromptFormField
        id="tags"
        label="Tags"
        value={metadata.tags?.join(", ") || ""}
        onChange={(value) => {
          const tags = value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
          onMetadataChange({ ...metadata, tags });
        }}
        placeholder="tag1, tag2, tag3"
      />
    </div>
  );
};

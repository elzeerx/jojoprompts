
import { PromptFormField } from "./PromptFormField";
import { TextPromptFields } from "./TextPromptFields";
import { ImageUploadField } from "./ImageUploadField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type PromptRow } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  // Define the main categories available for selection
  const mainCategories = ["ChatGPT", "Midjourney", "n8n"];

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
          promptType={promptType}
        />
      ) : (
        <>
          <TextPromptFields
            metadata={metadata}
            onMetadataChange={onMetadataChange}
          />
          <ImageUploadField
            imageURL={imageURL}
            file={file}
            onFileChange={onFileChange}
            promptType={promptType}
          />
        </>
      )}

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="category" className="text-right">
          Category
        </Label>
        <Select 
          value={metadata.category || "ChatGPT"} 
          onValueChange={(value) => onMetadataChange({ ...metadata, category: value })}
        >
          <SelectTrigger className="col-span-3 rounded-lg">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {mainCategories.map(category => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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

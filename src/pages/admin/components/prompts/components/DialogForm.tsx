
import { PromptFormField } from "./PromptFormField";
import { TextPromptFields } from "./TextPromptFields";
import { ImageUploadField } from "./ImageUploadField";
import { ButtonPromptFields } from "./ButtonPromptFields";
import { ImageSelectionFields } from "./ImageSelectionFields";
import { WorkflowFields } from "./WorkflowFields";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type PromptRow } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DialogFormProps {
  title: string;
  promptText: string;
  metadata: PromptRow["metadata"];
  promptType: "text" | "image" | "button" | "image-selection" | "workflow";
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

  // Determine which category this prompt type belongs to
  const getCategoryForPromptType = (type: string) => {
    if (["text", "image", "button"].includes(type)) return "ChatGPT";
    if (type === "image-selection") return "Midjourney";
    if (type === "workflow") return "n8n";
    return "ChatGPT"; // Default
  };

  // If category is not set, use the appropriate one for the prompt type
  if (!metadata.category) {
    const category = getCategoryForPromptType(promptType);
    onMetadataChange({ ...metadata, category });
  }

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
          className="col-span-3 rounded-lg"
        />
      </div>

      {/* Render specific fields based on promptType */}
      {promptType === "button" && (
        <ButtonPromptFields
          metadata={metadata}
          onMetadataChange={onMetadataChange}
        />
      )}

      {promptType === "image-selection" && (
        <ImageSelectionFields
          metadata={metadata}
          onMetadataChange={onMetadataChange}
        />
      )}

      {promptType === "workflow" && (
        <WorkflowFields
          metadata={metadata}
          onMetadataChange={onMetadataChange}
        />
      )}

      {/* Text prompt has additional fields */}
      {promptType === "text" && (
        <TextPromptFields
          metadata={metadata}
          onMetadataChange={onMetadataChange}
        />
      )}

      {/* Always show image upload for image type prompts */}
      {(promptType === "image" || promptType === "image-selection" || promptType === "text") && (
        <ImageUploadField
          imageURL={imageURL}
          file={file}
          onFileChange={onFileChange}
          promptType={promptType as "text" | "image" | "image-selection"}
        />
      )}

      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="category" className="text-right">
          Category
        </Label>
        <Select 
          value={metadata.category || getCategoryForPromptType(promptType)} 
          onValueChange={(value) => onMetadataChange({ ...metadata, category: value })}
        >
          <SelectTrigger className="col-span-3 rounded-lg">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent className="rounded-lg">
            {mainCategories.map(category => (
              <SelectItem key={category} value={category} className="rounded-lg">
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Style field for image prompts */}
      {(promptType === "image" || promptType === "image-selection") && (
        <PromptFormField
          id="style"
          label="Style"
          value={metadata.style || ""}
          onChange={(value) => onMetadataChange({ ...metadata, style: value })}
        />
      )}

      {/* Tags for all prompt types */}
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

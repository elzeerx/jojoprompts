
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
  
  // Get the appropriate accent color based on category
  const getCategoryColor = (category: string) => {
    switch (category) {
      case "ChatGPT": return "text-warm-gold";
      case "Midjourney": return "text-muted-teal";
      case "n8n": return "text-secondary";
      default: return "text-warm-gold";
    }
  };

  return (
    <div className="grid gap-5 py-4">
      <div className="space-y-1.5">
        <Label htmlFor="title" className={`${getCategoryColor(metadata.category || "")} font-medium`}>
          Title
        </Label>
        <input
          id="title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Enter a title for your prompt"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prompt_text" className={`${getCategoryColor(metadata.category || "")} font-medium`}>
          Prompt Text
        </Label>
        <Textarea
          id="prompt_text"
          value={promptText}
          onChange={(e) => onPromptTextChange(e.target.value)}
          className="min-h-[120px] rounded-md resize-y"
          placeholder="Write your prompt text here..."
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
        <div className="space-y-1.5">
          <Label htmlFor="image" className={`${getCategoryColor(metadata.category || "")} font-medium`}>
            {promptType === "image" ? "Prompt Image" : 
             promptType === "image-selection" ? "Selection Preview" : "Custom Default Image"}
          </Label>
          <ImageUploadField
            imageURL={imageURL}
            file={file}
            onFileChange={onFileChange}
            promptType={promptType as "text" | "image" | "image-selection"}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="category" className={`${getCategoryColor(metadata.category || "")} font-medium`}>
          Category
        </Label>
        <Select 
          value={metadata.category || getCategoryForPromptType(promptType)} 
          onValueChange={(value) => onMetadataChange({ ...metadata, category: value })}
        >
          <SelectTrigger className="rounded-md">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent className="rounded-md">
            {mainCategories.map(category => (
              <SelectItem key={category} value={category} className="rounded-md">
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Style field for image prompts */}
      {(promptType === "image" || promptType === "image-selection") && (
        <div className="space-y-1.5">
          <Label htmlFor="style" className={`${getCategoryColor(metadata.category || "")} font-medium`}>
            Style
          </Label>
          <input
            id="style"
            value={metadata.style || ""}
            onChange={(e) => onMetadataChange({ ...metadata, style: e.target.value })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="e.g., Realistic, Cartoon, Abstract"
          />
        </div>
      )}

      {/* Tags for all prompt types */}
      <div className="space-y-1.5">
        <Label htmlFor="tags" className={`${getCategoryColor(metadata.category || "")} font-medium`}>
          Tags
        </Label>
        <input
          id="tags"
          value={metadata.tags?.join(", ") || ""}
          onChange={(e) => {
            const tags = e.target.value
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean);
            onMetadataChange({ ...metadata, tags });
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="tag1, tag2, tag3"
        />
      </div>
    </div>
  );
};

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PromptFormField } from "./PromptFormField";
import { TextPromptFields } from "./TextPromptFields";
import { ImageUploadField } from "./ImageUploadField";
import { ButtonPromptFields } from "./ButtonPromptFields";
import { ImageSelectionFields } from "./ImageSelectionFields";
import { WorkflowFields } from "./WorkflowFields";

interface DialogFormProps {
  formData: {
    title: string;
    promptText: string;
    promptType: string;
    imagePath?: string;
    defaultImagePath?: string;
    metadata: any;
  };
  onChange: (formData: any) => void;
  onFileChange: (file: File) => void;
}

export function DialogForm({ formData, onChange, onFileChange }: DialogFormProps) {
  const updateFormData = (field: string, value: any) => {
    onChange({
      ...formData,
      [field]: value
    });
  };

  const updateMetadata = (metadata: any) => {
    onChange({
      ...formData,
      metadata
    });
  };

  return (
    <div className="space-y-6">
      <PromptFormField
        id="title"
        label="Title"
        value={formData.title}
        onChange={(value) => updateFormData('title', value)}
      />

      <div className="space-y-2">
        <label className="text-sm font-medium">Prompt Type</label>
        <Select 
          value={formData.promptType} 
          onValueChange={(value) => updateFormData('promptType', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select prompt type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
            <SelectItem value="video">Video</SelectItem>
            <SelectItem value="sound">Sound / Music</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Category</label>
        <Select 
          value={formData.metadata?.category || "ChatGPT"} 
          onValueChange={(value) => updateMetadata({ ...formData.metadata, category: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ChatGPT">ChatGPT</SelectItem>
            <SelectItem value="Midjourney">Midjourney</SelectItem>
            <SelectItem value="n8n">n8n</SelectItem>
            <SelectItem value="General">General</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <PromptFormField
        id="promptText"
        label="Prompt Text"
        value={formData.promptText}
        onChange={(value) => updateFormData('promptText', value)}
        type="textarea"
      />

      {formData.promptType === 'text' && (
        <TextPromptFields
          metadata={formData.metadata}
          onMetadataChange={updateMetadata}
        />
      )}

      {(formData.promptType === 'image' || formData.promptType === 'text') && (
        <ImageUploadField
          imageUrl={formData.imagePath}
          onImageChange={(path) => updateFormData('imagePath', path)}
          onFileChange={onFileChange}
          label={formData.promptType === 'text' ? "Custom Image (Optional)" : "Image"}
        />
      )}

      {formData.promptType === 'button' && (
        <ButtonPromptFields
          metadata={formData.metadata}
          onMetadataChange={updateMetadata}
        />
      )}

      {formData.promptType === 'image-selection' && (
        <ImageSelectionFields
          metadata={formData.metadata}
          onMetadataChange={updateMetadata}
        />
      )}

      {formData.promptType === 'workflow' && (
        <WorkflowFields
          metadata={formData.metadata}
          onMetadataChange={updateMetadata}
        />
      )}
    </div>
  );
}


import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PromptFormField } from "./PromptFormField";
import { TextPromptFields } from "./TextPromptFields";
import { MultiMediaUploadField } from "./MultiMediaUploadField";
import { ButtonPromptFields } from "./ButtonPromptFields";
import { ImageSelectionFields } from "./ImageSelectionFields";
import { WorkflowFields } from "./WorkflowFields";
import { AutoGenerateButton } from "./AutoGenerateButton";
import { ImageSelectionField } from "./ImageSelectionField";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

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
  onMultipleFilesChange?: (files: File[]) => void;
}

export function DialogForm({ formData, onChange, onFileChange, onMultipleFilesChange }: DialogFormProps) {
  const [generatedMetadata, setGeneratedMetadata] = useState<boolean>(false);

  useEffect(() => {
    // Reset generated state when form data changes from external sources
    if (formData && (!formData.metadata || Object.keys(formData.metadata).length === 0)) {
      setGeneratedMetadata(false);
    }
  }, [formData]);

  const updateFormData = (field: string, value: any) => {
    console.log("DialogForm - Updating form field:", field, "with value:", value);
    onChange({
      ...formData,
      [field]: value
    });
  };

  const updateMetadata = (metadata: any) => {
    console.log("DialogForm - Updating metadata:", metadata);
    onChange({
      ...formData,
      metadata
    });
  };

  const handleMediaFilesChange = (mediaFiles: any[]) => {
    updateMetadata({
      ...formData.metadata,
      media_files: mediaFiles
    });
  };

  const handleMultipleFilesChange = (files: File[]) => {
    if (onMultipleFilesChange) {
      onMultipleFilesChange(files);
    }
  };

  // Updated to handle auto-generated metadata without category
  const handleMetadataGenerated = (generatedMetadata: { style: string; tags: string[] }) => {
    console.log("DialogForm - Metadata generated (style and tags only):", generatedMetadata);
    
    // Preserve existing metadata fields that should not be overwritten
    const existingMediaFiles = formData.metadata?.media_files || [];
    const existingTargetModel = formData.metadata?.target_model || '';
    const existingUseCase = formData.metadata?.use_case || '';
    const existingCategory = formData.metadata?.category || 'ChatGPT'; // Keep the manually selected category
    
    const updatedMetadata = {
      ...formData.metadata,
      // Only update style and tags from auto-generation
      style: generatedMetadata.style,
      tags: generatedMetadata.tags,
      // Preserve these fields
      category: existingCategory, // Keep manual category selection
      media_files: existingMediaFiles,
      target_model: existingTargetModel,
      use_case: existingUseCase
    };
    
    console.log("DialogForm - Final merged metadata:", updatedMetadata);
    updateMetadata(updatedMetadata);
    setGeneratedMetadata(true);
  };

  const handleImagePathChange = (path: string) => {
    updateFormData('imagePath', path);
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

      <PromptFormField
        id="promptText"
        label="Prompt Text"
        value={formData.promptText}
        onChange={(value) => updateFormData('promptText', value)}
        type="textarea"
      />

      {/* Auto-generate metadata section - updated description */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-blue-900">Auto-generate Style & Tags</h3>
          <AutoGenerateButton
            promptText={formData.promptText}
            onMetadataGenerated={handleMetadataGenerated}
          />
        </div>
        <p className="text-xs text-blue-700">
          Let AI analyze your prompt text and automatically suggest style and tags. Category will be set manually below.
        </p>
        
        {generatedMetadata && (
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs font-medium text-blue-800 mb-2">Generated metadata:</p>
            <div className="flex flex-wrap gap-2">
              {formData.metadata?.style && (
                <Badge variant="outline" className="bg-purple-100 text-purple-800 hover:bg-purple-200">
                  Style: {formData.metadata.style}
                </Badge>
              )}
              {formData.metadata?.tags && formData.metadata.tags.map((tag: string, i: number) => (
                <Badge key={i} variant="outline" className="bg-green-100 text-green-800 hover:bg-green-200">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Category</label>
        <Select 
          value={formData.metadata?.category || "ChatGPT"} 
          onValueChange={(value) => {
            console.log("DialogForm - Manual category selection:", value);
            updateMetadata({ ...formData.metadata, category: value });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ChatGPT">ChatGPT</SelectItem>
            <SelectItem value="Midjourney">Midjourney</SelectItem>
            <SelectItem value="n8n">n8n</SelectItem>
            <SelectItem value="General">General</SelectItem>
            {formData.metadata?.category && 
             !["ChatGPT", "Midjourney", "n8n", "General"].includes(formData.metadata.category) && (
              <SelectItem value={formData.metadata.category}>{formData.metadata.category}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Main prompt image selection */}
      <ImageSelectionField
        currentImagePath={formData.imagePath}
        onImagePathChange={handleImagePathChange}
        onFileChange={onFileChange}
        label="Main Prompt Image"
      />

      {/* Multi-media upload for additional files */}
      <MultiMediaUploadField
        mediaFiles={formData.metadata?.media_files || []}
        onMediaFilesChange={handleMediaFilesChange}
        onFilesChange={handleMultipleFilesChange}
      />

      {formData.promptType === 'text' && (
        <TextPromptFields
          metadata={formData.metadata}
          onMetadataChange={updateMetadata}
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

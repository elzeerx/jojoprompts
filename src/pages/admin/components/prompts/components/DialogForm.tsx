
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PromptFormField } from "./PromptFormField";
import { TextPromptFields } from "./TextPromptFields";
import { MultiMediaUploadField } from "./MultiMediaUploadField";
import { ButtonPromptFields } from "./ButtonPromptFields";
import { ImageSelectionFields } from "./ImageSelectionFields";
import { WorkflowFields } from "./WorkflowFields";
import { WorkflowFileUpload } from "./WorkflowFileUpload";
import { SmartInputFields } from "./SmartInputFields";
import { ImageSelectionField } from "./ImageSelectionField";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useCategories } from "@/hooks/useCategories";
import { createLogger } from '@/utils/logging';

const logger = createLogger('DIALOG_FORM');

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
  onWorkflowFilesChange?: (files: File[]) => void;
}

export function DialogForm({ 
  formData, 
  onChange, 
  onFileChange, 
  onMultipleFilesChange,
  onWorkflowFilesChange 
}: DialogFormProps) {
  
  const [workflowFiles, setWorkflowFiles] = useState<any[]>([]);
  
  // Get categories from database
  const { categories, loading: categoriesLoading } = useCategories();
  const activeCategories = categories.filter(cat => cat.is_active);

  // Check if this is an n8n workflow prompt
  const isN8nWorkflow = formData.promptType === 'workflow' || 
                       (formData.metadata?.category && formData.metadata.category.toLowerCase().includes('n8n'));


  const updateFormData = (field: string, value: any) => {
    logger.debug('Updating form field', { field, valueType: typeof value });
    onChange({
      ...formData,
      [field]: value
    });
  };

  const updateMetadata = (metadata: any) => {
    logger.debug('Updating metadata', { metadataKeys: Object.keys(metadata || {}) });
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

  const handleWorkflowFilesChange = (workflowFiles: any[]) => {
    logger.debug('Workflow files changed', { count: workflowFiles.length });
    setWorkflowFiles(workflowFiles);
    updateMetadata({
      ...formData.metadata,
      workflow_files: workflowFiles.map(wf => ({
        type: wf.type,
        name: wf.name,
        path: wf.path || '' // Will be updated after upload
      }))
    });
  };

  const handleMultipleFilesChange = (files: File[]) => {
    if (onMultipleFilesChange) {
      onMultipleFilesChange(files);
    }
  };

  const handleWorkflowFileUpload = (files: File[]) => {
    logger.debug('Workflow files for upload', { count: files.length });
    // Pass workflow files to parent for upload
    if (onWorkflowFilesChange) {
      onWorkflowFilesChange(files);
    }
  };


  const handleImagePathChange = (path: string) => {
    updateFormData('imagePath', path);
  };

  return (
    <div className="space-y-4 md:space-y-6 mobile-element-spacing">
      <PromptFormField
        id="title"
        label="Title"
        value={formData.title}
        onChange={(value) => updateFormData('title', value)}
      />

      <div className="space-y-2">
        <label className="text-sm font-medium mobile-input">Prompt Type</label>
        <Select 
          value={formData.promptType} 
          onValueChange={(value) => updateFormData('promptType', value)}
        >
          <SelectTrigger className="mobile-select">
            <SelectValue placeholder="Select prompt type" />
          </SelectTrigger>
          <SelectContent className="bg-white border border-border shadow-lg rounded-lg z-50">
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

      {/* Smart Input System */}
      <div className="mobile-card">
        <SmartInputFields
          metadata={formData.metadata}
          onMetadataChange={updateMetadata}
          promptText={formData.promptText}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Category</label>
        <Select 
          value={formData.metadata?.category || "ChatGPT"} 
          onValueChange={(value) => {
            logger.info('Manual category selection', { category: value });
            updateMetadata({ ...formData.metadata, category: value });
          }}
          disabled={categoriesLoading}
        >
          <SelectTrigger className="mobile-select">
            <SelectValue placeholder={categoriesLoading ? "Loading categories..." : "Select category"} />
          </SelectTrigger>
          <SelectContent className="bg-white border border-border shadow-lg rounded-lg z-50">
            {/* Show active categories from database */}
            {activeCategories.map(category => (
              <SelectItem key={category.id} value={category.name}>
                {category.name}
              </SelectItem>
            ))}
            
            {/* Fallback options if no active categories or for backward compatibility */}
            {activeCategories.length === 0 && (
              <>
                <SelectItem value="ChatGPT">ChatGPT</SelectItem>
                <SelectItem value="Midjourney">Midjourney</SelectItem>
                <SelectItem value="n8n">n8n</SelectItem>
                <SelectItem value="General">General</SelectItem>
              </>
            )}
            
            {/* Show existing category if it's not in the active list */}
            {formData.metadata?.category && 
             !activeCategories.some(cat => cat.name === formData.metadata.category) &&
             !["ChatGPT", "Midjourney", "n8n", "General"].includes(formData.metadata.category) && (
              <SelectItem value={formData.metadata.category}>{formData.metadata.category}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Main prompt image selection */}
      <div className="mobile-card">
        <ImageSelectionField
          currentImagePath={formData.imagePath}
          onImagePathChange={handleImagePathChange}
          onFileChange={onFileChange}
          label="Main Prompt Image"
        />
      </div>

      {/* Multi-media upload for additional files */}
      <div className="mobile-card">
        <MultiMediaUploadField
          mediaFiles={formData.metadata?.media_files || []}
          onMediaFilesChange={handleMediaFilesChange}
          onFilesChange={handleMultipleFilesChange}
        />
      </div>

      {/* n8n Workflow File Upload - Only show for workflow prompts */}
      {isN8nWorkflow && (
        <div className="mobile-card">
          <WorkflowFileUpload
            workflowFiles={workflowFiles}
            onWorkflowFilesChange={handleWorkflowFilesChange}
            onFilesChange={handleWorkflowFileUpload}
          />
        </div>
      )}

      {formData.promptType === 'text' && (
        <div className="mobile-card">
          <TextPromptFields
            metadata={formData.metadata}
            onMetadataChange={updateMetadata}
            promptText={formData.promptText}
          />
        </div>
      )}

      {formData.promptType === 'button' && (
        <div className="mobile-card">
          <ButtonPromptFields
            metadata={formData.metadata}
            onMetadataChange={updateMetadata}
          />
        </div>
      )}

      {formData.promptType === 'image-selection' && (
        <div className="mobile-card">
          <ImageSelectionFields
            metadata={formData.metadata}
            onMetadataChange={updateMetadata}
          />
        </div>
      )}

      {formData.promptType === 'workflow' && (
        <div className="mobile-card">
          <WorkflowFields
            metadata={formData.metadata}
            onMetadataChange={updateMetadata}
          />
        </div>
      )}
    </div>
  );
}

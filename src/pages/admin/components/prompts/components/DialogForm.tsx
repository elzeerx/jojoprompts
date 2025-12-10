
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
import { ModelPromptTypeSelector } from "./ModelPromptTypeSelector";
import { DynamicFormRenderer } from "./DynamicFormRenderer";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useCategories } from "@/hooks/useCategories";
import { createLogger } from '@/utils/logging';
import { ALL_PROMPT_TYPES, ModelPromptType, getPromptTypeById, validatePromptData } from "@/utils/promptTypes";
import { ChevronDown, AlertCircle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [modelFieldData, setModelFieldData] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showTips, setShowTips] = useState(false);
  
  // Get categories from database
  const { categories, loading: categoriesLoading } = useCategories();
  const activeCategories = categories.filter(cat => cat.is_active);

  // Get selected prompt type definition
  const selectedPromptType = useMemo(() => {
    return getPromptTypeById(formData.promptType) || null;
  }, [formData.promptType]);

  // Check if this is an n8n workflow prompt
  const isN8nWorkflow = formData.promptType === 'workflow' || 
                       formData.promptType === 'workflow-n8n' ||
                       (formData.metadata?.category && formData.metadata.category.toLowerCase().includes('n8n'));

  // Initialize model field data from metadata when editing
  useEffect(() => {
    if (formData.metadata?.model_fields) {
      setModelFieldData(formData.metadata.model_fields);
    }
  }, []);

  // Real-time validation
  useEffect(() => {
    if (selectedPromptType && Object.keys(modelFieldData).length > 0) {
      const errors = validatePromptData(
        { ...modelFieldData, promptText: formData.promptText },
        selectedPromptType
      );
      setValidationErrors(errors);
    } else {
      setValidationErrors({});
    }
  }, [modelFieldData, formData.promptText, selectedPromptType]);

  const updateFormData = useCallback((field: string, value: any) => {
    logger.debug('Updating form field', { field, valueType: typeof value });
    onChange({
      ...formData,
      [field]: value
    });
  }, [formData, onChange]);

  const updateMetadata = useCallback((metadata: any) => {
    logger.debug('Updating metadata', { metadataKeys: Object.keys(metadata || {}) });
    onChange({
      ...formData,
      metadata
    });
  }, [formData, onChange]);

  // Handle prompt type selection with auto-category
  const handlePromptTypeSelect = useCallback((type: ModelPromptType) => {
    logger.info('Prompt type selected', { typeId: type.id, category: type.category });
    
    // Update prompt type
    updateFormData('promptType', type.id);
    
    // Auto-set category based on prompt type
    const categoryMapping: Record<string, string> = {
      'ChatGPT': 'ChatGPT',
      'Claude': 'Claude',
      'Midjourney': 'Midjourney',
      'Gemini': 'Gemini',
      'Flux': 'Flux',
      'Video': 'Video AI',
      'Sora': 'Video AI',
      'ElevenLabs': 'Audio AI',
      'Suno': 'Audio AI',
      'n8n': 'n8n',
    };
    
    const mappedCategory = categoryMapping[type.category] || type.category;
    
    // Check if category exists in active categories
    const categoryExists = activeCategories.some(cat => cat.name === mappedCategory);
    const finalCategory = categoryExists ? mappedCategory : (activeCategories[0]?.name || 'ChatGPT');
    
    updateMetadata({
      ...formData.metadata,
      category: finalCategory,
      model_type: type.id,
      model_fields: {}
    });
    
    // Reset model field data
    setModelFieldData({});
    setValidationErrors({});
  }, [formData, updateFormData, updateMetadata, activeCategories]);

  // Handle model-specific field changes
  const handleModelFieldChange = useCallback((fieldId: string, value: any) => {
    const newModelFieldData = { ...modelFieldData, [fieldId]: value };
    setModelFieldData(newModelFieldData);
    
    // Update metadata with model fields
    updateMetadata({
      ...formData.metadata,
      model_fields: newModelFieldData
    });
  }, [modelFieldData, formData.metadata, updateMetadata]);

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
        path: wf.path || ''
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
    if (onWorkflowFilesChange) {
      onWorkflowFilesChange(files);
    }
  };

  const handleImagePathChange = (path: string) => {
    updateFormData('imagePath', path);
  };

  // Check if there are validation errors
  const hasErrors = Object.keys(validationErrors).length > 0;

  return (
    <div className="space-y-4 md:space-y-6 mobile-element-spacing">
      <PromptFormField
        id="title"
        label="Title"
        value={formData.title}
        onChange={(value) => updateFormData('title', value)}
      />

      {/* Enhanced Prompt Type Selector */}
      <ModelPromptTypeSelector
        selectedTypeId={formData.promptType}
        onSelect={handlePromptTypeSelect}
      />

      {/* Prompt Text Field */}
      <PromptFormField
        id="promptText"
        label="Prompt Text"
        value={formData.promptText}
        onChange={(value) => updateFormData('promptText', value)}
        type="textarea"
        error={validationErrors.promptText}
      />

      {/* Dynamic Model-Specific Fields */}
      {selectedPromptType && selectedPromptType.fields.length > 1 && (
        <div className="space-y-4 p-4 bg-muted/20 rounded-lg border">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <span 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: selectedPromptType.color || 'hsl(var(--warm-gold))' }}
              />
              {selectedPromptType.name} Fields
            </h4>
            {hasErrors && (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                {Object.keys(validationErrors).length} errors
              </Badge>
            )}
          </div>
          
          <DynamicFormRenderer
            template={selectedPromptType}
            formData={{ ...modelFieldData, promptText: formData.promptText }}
            onChange={handleModelFieldChange}
            errors={validationErrors}
          />
        </div>
      )}

      {/* Tips & Examples */}
      {selectedPromptType && (selectedPromptType.tips.length > 0 || selectedPromptType.examples.length > 0) && (
        <Collapsible open={showTips} onOpenChange={setShowTips}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Lightbulb className="h-4 w-4" />
            Tips & Examples
            <ChevronDown className={cn("h-4 w-4 transition-transform", showTips && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            {selectedPromptType.tips.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h5 className="text-sm font-medium text-blue-900 mb-2">💡 Tips</h5>
                <ul className="text-xs text-blue-800 space-y-1">
                  {selectedPromptType.tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span>•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedPromptType.examples.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <h5 className="text-sm font-medium text-green-900 mb-2">📝 Examples</h5>
                <ul className="text-xs text-green-800 space-y-1">
                  {selectedPromptType.examples.map((example, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span>{idx + 1}.</span>
                      <span className="italic">{example}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Smart Input System */}
      <div className="mobile-card">
        <SmartInputFields
          metadata={formData.metadata}
          onMetadataChange={updateMetadata}
          promptText={formData.promptText}
        />
      </div>

      {/* Category Selector - Auto-populated but still editable */}
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
            {activeCategories.map(category => (
              <SelectItem key={category.id} value={category.name}>
                {category.name}
              </SelectItem>
            ))}
            
            {activeCategories.length === 0 && (
              <>
                <SelectItem value="ChatGPT">ChatGPT</SelectItem>
                <SelectItem value="Midjourney">Midjourney</SelectItem>
                <SelectItem value="n8n">n8n</SelectItem>
                <SelectItem value="General">General</SelectItem>
              </>
            )}
            
            {formData.metadata?.category && 
             !activeCategories.some(cat => cat.name === formData.metadata.category) &&
             !["ChatGPT", "Midjourney", "n8n", "General"].includes(formData.metadata.category) && (
              <SelectItem value={formData.metadata.category}>{formData.metadata.category}</SelectItem>
            )}
          </SelectContent>
        </Select>
        {selectedPromptType && (
          <p className="text-xs text-muted-foreground">
            Auto-set based on prompt type: {selectedPromptType.category}
          </p>
        )}
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

      {/* n8n Workflow File Upload */}
      {isN8nWorkflow && (
        <div className="mobile-card">
          <WorkflowFileUpload
            workflowFiles={workflowFiles}
            onWorkflowFilesChange={handleWorkflowFilesChange}
            onFilesChange={handleWorkflowFileUpload}
          />
        </div>
      )}

      {/* Legacy type-specific fields for backward compatibility */}
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

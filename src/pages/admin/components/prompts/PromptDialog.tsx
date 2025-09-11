import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Sparkles, Wand2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { IMAGE_BUCKET, VIDEO_BUCKET, AUDIO_BUCKET, FILE_BUCKET } from "@/utils/buckets";
import { toast } from "@/hooks/use-toast";
import { type PromptRow } from "@/types";
import { DialogForm } from "./components/DialogForm";
import { CategorySelector } from "./components/CategorySelector";
import { BilingualFields } from "./components/BilingualFields";
import { DynamicFormRenderer } from "./components/DynamicFormRenderer";
import { PromptPreview } from "./components/PromptPreview";
import { usePromptForm } from "./hooks/usePromptForm";
import { useAuth } from "@/contexts/AuthContext";
import { usePromptSubmission } from "./hooks/usePromptSubmission";
import { uploadFiles } from "./hooks/useFileUpload";
import { SecureImageUploadField } from "./components/SecureImageUploadField";
import { getCategoryColor } from "./utils/categoryUtils";
import { 
  CHATGPT_TEXT_PROMPT,
  CHATGPT_IMAGE_PROMPT,
  CLAUDE_TEXT_PROMPT,
  MIDJOURNEY_FULL_PROMPT,
  MIDJOURNEY_STYLE_REF_PROMPT,
  VIDEO_FULL_PROMPT,
  VIDEO_JSON_PROMPT,
  WORKFLOW_N8N_PROMPT,
  type ModelPromptType,
  validatePromptData
} from "@/utils/promptTypes";

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingPrompt?: PromptRow | null;
  promptType?: 'text' | 'image' | 'workflow' | 'video' | 'sound';
  category?: string;
}

interface PromptMetadata {
  category?: string;
  tags?: string[];
  style?: string;
  target_model?: string;
  use_case?: string;
  buttons?: Array<{ id: string; name: string; description: string; type: string }>;
  media_files?: Array<{ type: 'image' | 'video' | 'audio'; path: string; name: string }>;
  workflow_files?: Array<{ type: 'json' | 'zip'; path: string; name: string }>;
  workflow_steps?: Array<{ name: string; description: string; type?: string }>;
}

export function PromptDialog({ open, onOpenChange, onSuccess, editingPrompt, promptType, category }: PromptDialogProps) {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const [workflowFiles, setWorkflowFiles] = useState<File[]>([]);
  const [step, setStep] = useState<'template' | 'form'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<ModelPromptType | null>(null);
  const [bilingualData, setBilingualData] = useState({
    title: { en: '', ar: '' },
    promptText: { en: '', ar: '' }
  });
  const [templateFormData, setTemplateFormData] = useState<Record<string, any>>({});
  const [activeLanguage, setActiveLanguage] = useState<'en' | 'ar'>('en');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePath, setImagePath] = useState<string>('');
  const [generatorQuery, setGeneratorQuery] = useState<string>('');
  const { user } = useAuth();

  // Available templates
  const availableTemplates = [
    CHATGPT_TEXT_PROMPT,
    CHATGPT_IMAGE_PROMPT,
    CLAUDE_TEXT_PROMPT,
    MIDJOURNEY_FULL_PROMPT,
    MIDJOURNEY_STYLE_REF_PROMPT,
    VIDEO_FULL_PROMPT,
    VIDEO_JSON_PROMPT,
    WORKFLOW_N8N_PROMPT
  ];
  
  const {
    formData,
    setFormData,
    resetForm,
    validateForm
  } = usePromptForm(editingPrompt);

  console.log("PromptDialog - Dialog opened with editingPrompt:", editingPrompt?.id);
  console.log("PromptDialog - Current form data:", formData);

  // Initialize for editing existing prompts
  useEffect(() => {
    if (editingPrompt && open) {
      // Set step to form for existing prompts
      setStep('form');
      
      // Initialize bilingual data from existing prompt - handle both old and new format
      const translations = editingPrompt.metadata?.translations;
      setBilingualData({
        title: {
          en: editingPrompt.title || '',
          ar: (translations as any)?.title?.ar || (translations as any)?.arabic?.title || ''
        },
        promptText: {
          en: editingPrompt.prompt_text || '',
          ar: (translations as any)?.promptText?.ar || (translations as any)?.arabic?.prompt_text || ''
        }
      });
      
      // Find matching template
      const category = editingPrompt.metadata?.category;
      const matchingTemplate = availableTemplates.find(t => 
        t.category.toLowerCase() === category?.toLowerCase()
      ) || availableTemplates[0];
      
      setSelectedTemplate(matchingTemplate);
      
      // Initialize template data from metadata or extract from existing fields
      const existingTemplateData = (editingPrompt.metadata as any)?.templateData || {};
      // Add common fields that might exist in old format
      if (editingPrompt.metadata?.target_model) {
        existingTemplateData.target_model = editingPrompt.metadata.target_model;
      }
      if (editingPrompt.metadata?.style) {
        existingTemplateData.style = editingPrompt.metadata.style;
      }
      if (editingPrompt.metadata?.use_case) {
        existingTemplateData.use_case = editingPrompt.metadata.use_case;
      }
      
      setTemplateFormData(existingTemplateData);
    }
  }, [editingPrompt, open, availableTemplates]);

  // Initialize promptType and category for new prompts
  useEffect(() => {
    if (promptType && !editingPrompt && open) {
      console.log("PromptDialog - Setting initial prompt type and category for new prompt:", promptType, category);
      
      // Find matching template for provided category
      const matchingTemplate = availableTemplates.find(t => 
        t.category.toLowerCase() === (category || '').toLowerCase()
      );
      
      if (matchingTemplate) {
        setSelectedTemplate(matchingTemplate);
        setStep('form');
      }
      
      setFormData(prev => ({
        ...prev,
        promptType: promptType as 'text' | 'image' | 'workflow' | 'video' | 'sound',
        metadata: {
          ...prev.metadata,
          category: category || prev.metadata?.category || 'ChatGPT'
        }
      }));
    }
  }, [promptType, category, setFormData, editingPrompt, open, availableTemplates]);

  // Reset auxiliary state when dialog closes
  useEffect(() => {
    if (!open) {
      console.log("PromptDialog - Dialog closed, resetting auxiliary state");
      setCurrentFile(null);
      setCurrentFiles([]);
      setWorkflowFiles([]);
      setStep('template');
      setSelectedTemplate(null);
      setBilingualData({ title: { en: '', ar: '' }, promptText: { en: '', ar: '' } });
      setTemplateFormData({});
      setValidationErrors({});
      setIsGenerating(false);
      setImageFile(null);
      setImagePath('');
      setGeneratorQuery('');
    }
  }, [open]);

  const { isSubmitting, handleSubmit } = usePromptSubmission({
    onSuccess,
    onOpenChange,
    editingPrompt,
  });

  // Handle template selection
  const handleTemplateSelect = (template: ModelPromptType) => {
    setSelectedTemplate(template);
    setStep('form');
    
    // Initialize template form data with default values
    const initialData: Record<string, any> = {};
    template.fields.forEach(field => {
      if (field.defaultValue !== undefined) {
        initialData[field.id] = field.defaultValue;
      }
    });
    setTemplateFormData(initialData);
  };

  // Handle form submission with enhanced data
  const handleEnhancedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTemplate) {
      toast({
        title: "Template Required",
        description: "Please select a template before creating the prompt",
        variant: "destructive"
      });
      return;
    }

    // Validate template-specific data
    if (selectedTemplate.validation) {
      const errors = validatePromptData(templateFormData, selectedTemplate);
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        toast({
          title: "Validation Error",
          description: "Please fix the highlighted errors",
          variant: "destructive"
        });
        return;
      }
    }

    // Prepare enhanced form data
    const enhancedFormData = {
      ...formData,
      title: bilingualData.title.en || bilingualData.title.ar,
      promptText: bilingualData.promptText.en || bilingualData.promptText.ar,
      imagePath: imagePath || formData.imagePath,
      metadata: {
        ...formData.metadata,
        category: selectedTemplate.category,
        translations: bilingualData,
        templateData: templateFormData
      }
    };

    // Use the existing submission logic
    return handleSubmit(
      e,
      enhancedFormData,
      () => true, // Skip basic validation as we handle it above
      imageFile || currentFile,
      currentFiles,
      workflowFiles
    );
  };

  // Handle going back to template selection
  const handleBack = () => {
    setStep('template');
    setValidationErrors({});
  };

  // Handle auto-generation
  const handleAutoGenerate = async () => {
    if (!selectedTemplate) {
      toast({
        title: "Template Required",
        description: "Please select a template first",
        variant: "destructive"
      });
      return;
    }

    const query = generatorQuery.trim();
    if (!query || query.length < 8) {
      toast({
        title: "Description Required",
        description: "Please describe what you want the AI to generate (minimum 8 characters)",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('auto-generate-prompt', {
        body: {
          category: selectedTemplate.category,
          use_case: templateFormData.use_case,
          style: templateFormData.style,
          description: query
        }
      });

      if (error) throw error;

      if (data?.prompt) {
        // Update bilingual data with generated content
        setBilingualData(prev => ({
          ...prev,
          title: {
            en: data.title || prev.title.en,
            ar: prev.title.ar
          },
          promptText: {
            en: data.prompt,
            ar: prev.promptText.ar
          }
        }));

        toast({
          title: "Prompt Generated",
          description: "AI has generated a new prompt for you"
        });
      }
    } catch (error: any) {
      console.error('Auto-generation error:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate prompt",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'chatgpt':
        return 'hsl(var(--warm-gold))';
      case 'claude':
        return 'hsl(var(--muted-teal))';
      case 'midjourney':
        return 'hsl(var(--muted-teal))';
      case 'workflow':
        return '#8b7fb8';
      case 'video':
        return '#ff6b9d';
      default:
        return 'hsl(var(--warm-gold))';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="prompt-dialog w-full max-w-7xl h-[95vh] flex flex-col p-0">
        {/* Fixed Header */}
        <div className="flex-shrink-0 p-6 border-b border-border">
          <div className="flex items-center gap-4">
            {step === 'form' && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBack}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            
            <div className="flex-1">
              {selectedTemplate && (
                <Badge 
                  className="text-white text-xs mb-2"
                  style={{ backgroundColor: getCategoryColor(selectedTemplate.category) }}
                >
                  {selectedTemplate.category} • {selectedTemplate.name}
                </Badge>
              )}
              <DialogHeader className="text-left p-0">
                <DialogTitle className="text-2xl sm:text-3xl font-bold text-foreground leading-tight flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-[var(--warm-gold)]" />
                  {editingPrompt ? "Edit Prompt" : "Create Enhanced Prompt"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {step === 'template' 
                    ? "Choose an AI model template to get started"
                    : "Fill in the details for your AI prompt"
                  }
                </p>
              </DialogHeader>
            </div>
          </div>
        </div>
        
        {/* Scrollable Content */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-6">
            {step === 'template' ? (
              // Template Selection Step
              <CategorySelector
                templates={availableTemplates}
                selectedTemplate={selectedTemplate}
                onTemplateSelect={handleTemplateSelect}
              />
            ) : (
              // Form Step
              <form onSubmit={handleEnhancedSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Form Fields */}
                  <div className="space-y-6">
                    {/* Auto-Generate Section */}
                    <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-6 rounded-xl border border-purple-200">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <Wand2 className="h-5 w-5 text-purple-600" />
                            AI Prompt Generator
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Let AI create a professional prompt for you using GPT-5
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={handleAutoGenerate}
                          disabled={isGenerating || !selectedTemplate || generatorQuery.trim().length < 8}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          size="sm"
                        >
                          {isGenerating ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Generating...
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4" />
                              Generate
                            </div>
                          )}
                        </Button>
                      </div>
                      
                      {/* User Input Field */}
                      <div className="space-y-2">
                        <label htmlFor="generator-query" className="block text-sm font-medium text-foreground">
                          Describe what you want the AI to generate:
                        </label>
                        <Textarea
                          id="generator-query"
                          placeholder="e.g., Create a prompt for writing engaging blog posts about technology, include SEO best practices..."
                          value={generatorQuery}
                          onChange={(e) => setGeneratorQuery(e.target.value)}
                          className="min-h-[80px] resize-none"
                          disabled={isGenerating}
                        />
                        <p className="text-xs text-muted-foreground">
                          {generatorQuery.length}/8 characters minimum
                        </p>
                      </div>
                    </div>

                    {/* Image Upload Section */}
                    <div className="bg-background/60 p-6 rounded-xl border border-border">
                      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Prompt Thumbnail
                      </h3>
                      <SecureImageUploadField
                        imageUrl={imagePath}
                        onImageChange={setImagePath}
                        onFileChange={setImageFile}
                        label="Upload or select an image for this prompt"
                      />
                    </div>

                    <div className="bg-background/60 p-6 rounded-xl border border-border">
                      <BilingualFields
                        title={bilingualData.title}
                        promptText={bilingualData.promptText}
                        onTitleChange={(title) => setBilingualData(prev => ({ ...prev, title }))}
                        onPromptTextChange={(promptText) => setBilingualData(prev => ({ ...prev, promptText }))}
                      />
                    </div>

                    {selectedTemplate && (
                      <div className="bg-background/60 p-6 rounded-xl border border-border">
                        <DynamicFormRenderer
                          template={selectedTemplate}
                          formData={templateFormData}
                          onChange={(fieldId, value) => {
                            setTemplateFormData(prev => ({ ...prev, [fieldId]: value }));
                            // Clear validation error for this field
                            if (validationErrors[fieldId]) {
                              setValidationErrors(prev => {
                                const { [fieldId]: _, ...rest } = prev;
                                return rest;
                              });
                            }
                          }}
                          errors={validationErrors}
                        />
                      </div>
                    )}
                  </div>

                  {/* Right Column - Preview */}
                  <div className="lg:sticky lg:top-0 lg:h-fit">
                    <PromptPreview
                      template={selectedTemplate}
                      formData={templateFormData}
                      bilingualData={bilingualData}
                      language={activeLanguage}
                    />
                  </div>
                </div>
                
                {/* Form Footer Buttons */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 pb-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                    className="px-6 py-3 text-base font-semibold rounded-xl order-2 sm:order-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-3 text-base font-semibold rounded-xl shadow-md order-1 sm:order-2"
                    style={{ 
                      backgroundColor: selectedTemplate ? getCategoryColor(selectedTemplate.category) : 'hsl(var(--warm-gold))',
                      color: 'white'
                    }}
                  >
                    {isSubmitting 
                      ? (editingPrompt ? "Updating..." : "Creating...") 
                      : (editingPrompt ? "Update Prompt" : "Create Prompt")
                    }
                  </Button>
                </div>
              </form>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

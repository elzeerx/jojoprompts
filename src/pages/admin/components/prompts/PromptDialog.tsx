import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Sparkles, Wand2, Upload, History, ChevronLeft, ChevronRight, FileText, Type } from "lucide-react";
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
  const [step, setStep] = useState<'generate' | 'edit' | 'metadata' | 'preview'>('generate');
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
  const [aiResult, setAiResult] = useState<{title: string; prompt: string} | null>(null);
  const [hasAppliedAI, setHasAppliedAI] = useState(false);
  const [refineInput, setRefineInput] = useState<string>('');
  const [resultHistory, setResultHistory] = useState<{title: string; prompt: string; query: string}[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
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
      // Set step to edit for existing prompts (skip generate step)
      setStep('edit');
      
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
        // For ChatGPT Text prompts, start with generate step
        setStep(matchingTemplate.category === 'ChatGPT' ? 'generate' : 'edit');
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
      setStep('generate');
      setSelectedTemplate(null);
      setBilingualData({ title: { en: '', ar: '' }, promptText: { en: '', ar: '' } });
      setTemplateFormData({});
      setValidationErrors({});
      setIsGenerating(false);
      setImageFile(null);
      setImagePath('');
      setGeneratorQuery('');
      setAiResult(null);
      setHasAppliedAI(false);
      setRefineInput('');
      setResultHistory([]);
      setHistoryIndex(-1);
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
    // For ChatGPT Text prompts, go to generate step; others go to edit step
    setStep(template.category === 'ChatGPT' ? 'generate' : 'edit');
    
    // Initialize template form data with default values
    const initialData: Record<string, any> = {};
    template.fields.forEach(field => {
      if (field.defaultValue !== undefined) {
        initialData[field.id] = field.defaultValue;
      }
    });
    setTemplateFormData(initialData);
  };

  // Handle step navigation
  const handleNext = () => {
    switch (step) {
      case 'generate':
        setStep('edit');
        break;
      case 'edit':
        setStep('metadata');
        break;
      case 'metadata':
        setStep('preview');
        break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'edit':
        if (selectedTemplate?.category === 'ChatGPT') {
          setStep('generate');
        } else {
          // Go back to template selection for non-ChatGPT text prompts
          setStep('generate');
          setSelectedTemplate(null);
        }
        break;
      case 'metadata':
        setStep('edit');
        break;
      case 'preview':
        setStep('metadata');
        break;
      case 'generate':
        setSelectedTemplate(null);
        break;
    }
    setValidationErrors({});
  };

  // Check if Next button should be enabled
  const canProceedToNext = () => {
    switch (step) {
      case 'generate':
        // Can proceed if AI result exists OR user wants to skip to manual
        return aiResult !== null || true; // Allow manual skip
      case 'edit':
        // Basic validation for title and prompt
        return (bilingualData.title.en.trim() || bilingualData.title.ar.trim()) && 
               (bilingualData.promptText.en.trim() || bilingualData.promptText.ar.trim());
      case 'metadata':
        return true; // Always can proceed from metadata
      default:
        return true;
    }
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
        // Store the AI result in state instead of directly updating form
        const newResult = {
          title: data.title || "Generated Prompt",
          prompt: data.prompt
        };
        
        setAiResult(newResult);

        // Add to history
        const historyEntry = {
          ...newResult,
          query: query + (refineInput ? ` (Refined: ${refineInput})` : '')
        };
        setResultHistory(prev => [...prev, historyEntry]);
        setHistoryIndex(prev => prev + 1);

        toast({
          title: "Prompt Generated Successfully",
          description: "Review the generated content and click 'Use Result' to apply it"
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
      setRefineInput(''); // Clear refine input after generation
    }
  };

  // Handle applying AI result to form
  const handleApplyResult = () => {
    if (!aiResult) return;
    
    setBilingualData(prev => ({
      ...prev,
      title: {
        en: aiResult.title,
        ar: prev.title.ar
      },
      promptText: {
        en: aiResult.prompt,
        ar: prev.promptText.ar
      }
    }));

    // Mark that AI result has been applied
    setHasAppliedAI(true);
    
    // Clear the AI result after applying
    setAiResult(null);
    
    toast({
      title: "Result Applied",
      description: "The generated content has been applied to your prompt"
    });
  };

  // Handle applying only title
  const handleApplyTitle = () => {
    if (!aiResult) return;
    
    setBilingualData(prev => ({
      ...prev,
      title: {
        en: aiResult.title,
        ar: prev.title.ar
      }
    }));

    toast({
      title: "Title Applied",
      description: "The generated title has been applied"
    });
  };

  // Handle applying only prompt
  const handleApplyPrompt = () => {
    if (!aiResult) return;
    
    setBilingualData(prev => ({
      ...prev,
      promptText: {
        en: aiResult.prompt,
        ar: prev.promptText.ar
      }
    }));

    toast({
      title: "Prompt Applied", 
      description: "The generated prompt has been applied"
    });
  };

  // Handle regenerating with same query
  const handleRegenerate = () => {
    if (generatorQuery.trim().length >= 8) {
      handleAutoGenerate();
    }
  };

  // Handle improve generation
  const handleImprove = async () => {
    if (!refineInput.trim() || !generatorQuery.trim()) {
      toast({
        title: "Refinement Required",
        description: "Please enter how you'd like to improve the prompt",
        variant: "destructive"
      });
      return;
    }

    // Combine original query with refinement
    const combinedQuery = `${generatorQuery.trim()}\n\nAdditional instructions: ${refineInput.trim()}`;
    
    if (!selectedTemplate) return;

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('auto-generate-prompt', {
        body: {
          category: selectedTemplate.category,
          use_case: templateFormData.use_case,
          style: templateFormData.style,
          description: combinedQuery
        }
      });

      if (error) throw error;

      if (data?.prompt) {
        const newResult = {
          title: data.title || "Generated Prompt",
          prompt: data.prompt
        };
        
        setAiResult(newResult);

        // Add to history
        const historyEntry = {
          ...newResult,
          query: `${generatorQuery} (Refined: ${refineInput})`
        };
        setResultHistory(prev => [...prev, historyEntry]);
        setHistoryIndex(prev => prev + 1);

        toast({
          title: "Prompt Improved",
          description: "Generated an improved version based on your feedback"
        });
      }
    } catch (error: any) {
      console.error('Improve generation error:', error);
      toast({
        title: "Improvement Failed",
        description: error.message || "Failed to improve prompt",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
      setRefineInput('');
    }
  };

  // Handle history navigation
  const handleHistoryBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setAiResult(resultHistory[newIndex]);
    }
  };

  const handleHistoryForward = () => {
    if (historyIndex < resultHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setAiResult(resultHistory[newIndex]);
    }
  };

  // Get step title and description
  const getStepInfo = () => {
    switch (step) {
      case 'generate':
        return {
          title: "Generate AI Prompt",
          description: "Let AI create a professional prompt for you"
        };
      case 'edit':
        return {
          title: "Review & Edit",
          description: "Customize your prompt content and translations"
        };
      case 'metadata':
        return {
          title: "Metadata & Thumbnail",
          description: "Add additional details and upload thumbnail"
        };
      case 'preview':
        return {
          title: "Preview & Save",
          description: "Review your prompt before saving"
        };
      default:
        return {
          title: "Create Enhanced Prompt",
          description: "Fill in the details for your AI prompt"
        };
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
      <DialogContent className="prompt-dialog w-full max-w-[95vw] md:max-w-6xl h-[90vh] md:h-[95vh] flex flex-col p-0 mobile-container-padding">
        {/* Fixed Header */}
        <div className="flex-shrink-0 p-4 md:p-6 border-b border-border mobile-section-padding">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Step Navigation */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {selectedTemplate && step !== 'generate' && (
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
              
              {!selectedTemplate && (
                <div className="text-sm text-muted-foreground">
                  Step 1: Choose Template
                </div>
              )}
              
              {selectedTemplate && (
                <div className="flex items-center gap-2">
                  <div className="text-sm text-muted-foreground">
                    Step {step === 'generate' ? '1' : step === 'edit' ? '2' : step === 'metadata' ? '3' : '4'} of 4
                  </div>
                  <div className="flex gap-1">
                    {['generate', 'edit', 'metadata', 'preview'].map((s, i) => (
                      <div
                        key={s}
                        className={`w-2 h-2 rounded-full ${
                          step === s 
                            ? 'bg-[var(--warm-gold)]' 
                            : (i < ['generate', 'edit', 'metadata', 'preview'].indexOf(step) 
                                ? 'bg-green-500' 
                                : 'bg-gray-300')
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex-1 w-full sm:w-auto">
              {selectedTemplate && (
                <Badge 
                  className="text-white text-xs mb-2 inline-flex"
                  style={{ backgroundColor: getCategoryColor(selectedTemplate.category) }}
                >
                  {selectedTemplate.category} • {selectedTemplate.name}
                </Badge>
              )}
              <DialogHeader className="text-left p-0">
                <DialogTitle className="text-xl md:text-2xl xl:text-3xl font-bold text-foreground leading-tight flex items-center gap-2 flex-wrap">
                  <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-[var(--warm-gold)] flex-shrink-0" />
                  <span className="break-words">{editingPrompt ? "Edit Prompt" : (selectedTemplate ? getStepInfo().title : "Create Enhanced Prompt")}</span>
                </DialogTitle>
                <p className="text-xs md:text-sm text-muted-foreground mt-1 break-words">
                  {selectedTemplate ? getStepInfo().description : "Choose an AI model template to get started"}
                </p>
              </DialogHeader>
            </div>

            {/* Next Button */}
            {selectedTemplate && step !== 'preview' && (
              <Button
                onClick={handleNext}
                disabled={!canProceedToNext()}
                className="bg-[var(--warm-gold)] hover:bg-[var(--warm-gold)]/90 text-white w-full sm:w-auto mobile-button-primary"
                size="sm"
              >
                Next
              </Button>
            )}
          </div>
        </div>
        
        {/* Scrollable Content */}
        <ScrollArea className="flex-1 px-4 md:px-6 mobile-container-padding">
          <div className="py-4 md:py-6 mobile-section-padding">
            {!selectedTemplate ? (
              // Template Selection Step
              <CategorySelector
                templates={availableTemplates}
                selectedTemplate={selectedTemplate}
                onTemplateSelect={handleTemplateSelect}
              />
            ) : step === 'generate' ? (
              // Step 1: Generate
              <div className="w-full max-w-2xl mx-auto">
                <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4 md:p-8 rounded-xl border border-purple-200 mobile-card">
                  <div className="text-center mb-4 md:mb-6">
                    <h3 className="text-lg md:text-xl font-semibold text-foreground flex items-center justify-center gap-2 mb-2 flex-wrap">
                      <Wand2 className="h-5 w-5 md:h-6 md:w-6 text-purple-600 flex-shrink-0" />
                      <span>AI Prompt Generator</span>
                    </h3>
                    <p className="text-sm md:text-base text-muted-foreground break-words">
                      Describe what you want and let GPT-5 create a professional prompt for you
                    </p>
                  </div>
                  
                  {/* User Input Field */}
                  <div className="space-y-3">
                    <label htmlFor="generator-query" className="block text-sm font-medium text-foreground">
                      Describe what you want the AI to generate:
                    </label>
                    <Textarea
                      id="generator-query"
                      placeholder="e.g., Create a prompt for writing engaging blog posts about technology, include SEO best practices and target audience considerations..."
                      value={generatorQuery}
                      onChange={(e) => setGeneratorQuery(e.target.value)}
                      className="min-h-[100px] md:min-h-[120px] resize-none text-sm md:text-base"
                      disabled={isGenerating}
                    />
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="text-xs text-muted-foreground space-y-1 order-2 sm:order-1">
                        <p>{generatorQuery.length}/8 characters minimum</p>
                        <p className="text-green-600 break-words">💡 Tip: Be specific about your target audience, tone, and desired outcomes</p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleAutoGenerate}
                        disabled={isGenerating || !selectedTemplate || generatorQuery.trim().length < 8}
                        className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto mobile-button-primary order-1 sm:order-2"
                        size="sm"
                      >
                        {isGenerating ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span className="hidden sm:inline">Generating...</span>
                            <span className="sm:hidden">...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            <span>Generate</span>
                          </div>
                        )}
                      </Button>
                    </div>

                    {/* Example Tips */}
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <h4 className="text-xs font-medium text-blue-800 mb-2">💡 Example prompts:</h4>
                      <ul className="text-xs text-blue-700 space-y-1">
                        <li>• "Create a social media content prompt for tech startups, focus on engagement"</li>
                        <li>• "Generate a creative writing prompt for fantasy stories with character development"</li>
                        <li>• "Make a prompt for email marketing that converts, include urgency and personalization"</li>
                      </ul>
                    </div>
                  </div>

                  {/* AI Result Display */}
                  {aiResult && (
                    <div className="mt-6 p-6 bg-white rounded-lg border border-green-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-green-800 flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Generated Result
                          </h4>
                          {/* History Navigation */}
                          {resultHistory.length > 1 && (
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleHistoryBack}
                                disabled={historyIndex <= 0}
                                className="h-6 w-6 p-0"
                              >
                                <ChevronLeft className="h-3 w-3" />
                              </Button>
                              <span className="text-xs text-gray-500 min-w-[40px] text-center">
                                {historyIndex + 1}/{resultHistory.length}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleHistoryForward}
                                disabled={historyIndex >= resultHistory.length - 1}
                                className="h-6 w-6 p-0"
                              >
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(`Title: ${aiResult.title}\n\nPrompt: ${aiResult.prompt}`)}
                            className="text-xs"
                          >
                            Copy
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRegenerate}
                            disabled={isGenerating}
                            className="text-xs"
                          >
                            Regenerate
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <div className="text-xs font-medium text-gray-600 mb-1">Title:</div>
                          <div className="text-sm p-3 bg-gray-50 rounded border">{aiResult.title}</div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-600 mb-1">Prompt:</div>
                          <div className="text-sm p-3 bg-gray-50 rounded border max-h-40 overflow-y-auto whitespace-pre-wrap">{aiResult.prompt}</div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleApplyTitle}
                            className="flex items-center gap-1 text-xs"
                          >
                            <Type className="h-3 w-3" />
                            Use Title Only
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleApplyPrompt}
                            className="flex items-center gap-1 text-xs"
                          >
                            <FileText className="h-3 w-3" />
                            Use Prompt Only
                          </Button>
                          <Button
                            type="button"
                            onClick={handleApplyResult}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white text-xs"
                          >
                            Use Both
                          </Button>
                        </div>

                        {/* Refine Section */}
                        <div className="border-t pt-4">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Make it more concise, add examples, etc..."
                              value={refineInput}
                              onChange={(e) => setRefineInput(e.target.value)}
                              className="flex-1 text-sm"
                              disabled={isGenerating}
                            />
                            <Button
                              type="button"
                              onClick={handleImprove}
                              disabled={isGenerating || !refineInput.trim()}
                              variant="outline"
                              size="sm"
                              className="text-xs"
                            >
                              {isGenerating ? (
                                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                "Improve"
                              )}
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">💡 Tell AI how to improve the result</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Skip to Manual Option */}
                  <div className="text-center mt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleNext}
                      className="text-muted-foreground"
                    >
                      Skip to Manual Entry
                    </Button>
                  </div>
                </div>
              </div>
            ) : step === 'edit' ? (
              // Step 2: Review & Edit
              <form onSubmit={handleEnhancedSubmit} className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                  {/* Left Column - Bilingual Fields */}
                  <div className="space-y-4 md:space-y-6 order-1">
                    <div className="bg-background/60 p-4 md:p-6 rounded-xl border border-border mobile-card">
                      <BilingualFields
                        title={bilingualData.title}
                        promptText={bilingualData.promptText}
                        onTitleChange={(title) => setBilingualData(prev => ({ ...prev, title }))}
                        onPromptTextChange={(promptText) => setBilingualData(prev => ({ ...prev, promptText }))}
                      />
                    </div>

                    {/* Template-specific Fields */}
                    {selectedTemplate && selectedTemplate.fields.length > 0 && (
                      <div className="bg-background/60 p-4 md:p-6 rounded-xl border border-border mobile-card">
                        <h3 className="font-medium md:font-semibold text-foreground mb-3 md:mb-4 text-sm md:text-base">Template Configuration</h3>
                        <DynamicFormRenderer
                          template={selectedTemplate}
                          formData={templateFormData}
                          onChange={(fieldId, value) => setTemplateFormData(prev => ({ ...prev, [fieldId]: value }))}
                          errors={validationErrors}
                        />
                      </div>
                    )}
                  </div>

                  {/* Right Column - Preview */}
                  <div className="space-y-4 md:space-y-6 order-2">
                    <div className="bg-background/60 p-4 md:p-6 rounded-xl border border-border mobile-card">
                      <PromptPreview
                        template={selectedTemplate}
                        formData={templateFormData}
                        bilingualData={bilingualData}
                        language={activeLanguage}
                      />
                    </div>
                  </div>
                </div>
              </form>
            ) : step === 'metadata' ? (
              // Step 3: Metadata & Thumbnail
              <form onSubmit={handleEnhancedSubmit} className="space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-4 md:space-y-6 order-1">
                    {/* Image Upload Section */}
                    <div className="bg-background/60 p-4 md:p-6 rounded-xl border border-border mobile-card">
                      <h3 className="font-medium md:font-semibold text-foreground mb-3 md:mb-4 flex items-center gap-2 text-sm md:text-base">
                        <Upload className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                        <span>Prompt Thumbnail</span>
                      </h3>
                      <SecureImageUploadField
                        imageUrl={imagePath}
                        onImageChange={setImagePath}
                        onFileChange={setImageFile}
                        label="Upload or select an image for this prompt"
                      />
                    </div>

                    {/* Additional Form Fields */}
                    <DialogForm
                      formData={formData}
                      onChange={setFormData}
                      onFileChange={setCurrentFile}
                      onMultipleFilesChange={setCurrentFiles}
                      onWorkflowFilesChange={setWorkflowFiles}
                    />
                  </div>

                  {/* Right Column - Preview */}
                  <div className="space-y-4 md:space-y-6 order-2">
                    <div className="bg-background/60 p-4 md:p-6 rounded-xl border border-border mobile-card">
                      <PromptPreview
                        template={selectedTemplate}
                        formData={templateFormData}
                        bilingualData={bilingualData}
                        language={activeLanguage}
                      />
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              // Step 4: Preview & Save
              <form onSubmit={handleEnhancedSubmit} className="space-y-4 md:space-y-6">
                <div className="w-full max-w-4xl mx-auto">
                  <div className="bg-background/60 p-4 md:p-8 rounded-xl border border-border mobile-card">
                    <h3 className="text-lg md:text-xl font-semibold text-foreground mb-4 md:mb-6 text-center">Final Preview</h3>
                    <PromptPreview
                      template={selectedTemplate}
                      formData={templateFormData}
                      bilingualData={bilingualData}
                      language={activeLanguage}
                    />
                  </div>

                  {/* Form Footer Buttons */}
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 md:pt-6 border-t border-border mt-4 md:mt-6 mobile-section-padding">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={isSubmitting}
                      className="px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-medium md:font-semibold rounded-lg md:rounded-xl order-2 sm:order-1 mobile-button-secondary w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-medium md:font-semibold rounded-lg md:rounded-xl shadow-md order-1 sm:order-2 mobile-button-primary w-full sm:w-auto"
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
                </div>
              </form>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
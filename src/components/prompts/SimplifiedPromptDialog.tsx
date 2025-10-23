/**
 * SimplifiedPromptDialog - Unified Prompt Creation and Editing Component
 * 
 * A streamlined dialog for creating and editing prompts with all essential features
 * including title, prompt text, category selection, AI-generated tags, thumbnail upload,
 * translation support, and file attachments.
 * 
 * @example
 * ```tsx
 * // Create new prompt
 * <SimplifiedPromptDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onSuccess={() => console.log('Prompt created')}
 * />
 * 
 * // Edit existing prompt
 * <SimplifiedPromptDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   editingPrompt={prompt}
 *   onSuccess={() => console.log('Prompt updated')}
 * />
 * ```
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
import { supabase } from "@/integrations/supabase/client";
import { TagsManager } from "@/components/prompt-generator/TagsManager";
import { TranslationButtons } from "@/components/prompt-generator/TranslationButtons";
import { ThumbnailManager } from "@/components/prompt-generator/ThumbnailManager";
import { CategorySelector } from "@/components/prompt-generator/CategorySelector";
import { Badge } from "@/components/ui/badge";
import { type PromptRow } from "@/types";
import { PromptDialogHeader } from "./components/PromptDialogHeader";

/**
 * Props for SimplifiedPromptDialog component
 */
interface SimplifiedPromptDialogProps {
  /** Controls dialog visibility */
  open: boolean;
  /** Callback to control dialog open/close state */
  onOpenChange: (open: boolean) => void;
  /** Optional prompt data for edit mode */
  editingPrompt?: PromptRow | null;
  /** Callback fired on successful creation/update */
  onSuccess?: () => void;
}

interface TranslationData {
  title?: string;
  prompt_text?: string;
}

interface FormData {
  title: string;
  promptText: string;
  category: string;
  tags: string[];
  thumbnail: string | null;
  translations: {
    arabic?: TranslationData;
    english?: TranslationData;
  };
  attachedFiles: File[];
}

export function SimplifiedPromptDialog({
  open,
  onOpenChange,
  editingPrompt,
  onSuccess
}: SimplifiedPromptDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { categories } = useCategories();
  
  const [formData, setFormData] = useState<FormData>({
    title: "",
    promptText: "",
    category: "",
    tags: [],
    thumbnail: null,
    translations: {},
    attachedFiles: []
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // Load editing prompt data
  useEffect(() => {
    if (editingPrompt) {
      setFormData({
        title: editingPrompt.title || "",
        promptText: editingPrompt.prompt_text || "",
        category: editingPrompt.metadata?.category || "",
        tags: editingPrompt.metadata?.tags || [],
        thumbnail: editingPrompt.image_path || null,
        translations: editingPrompt.metadata?.translations || {},
        attachedFiles: []
      });
    } else {
      // Reset form for new prompt
      setFormData({
        title: "",
        promptText: "",
        category: "",
        tags: [],
        thumbnail: null,
        translations: {},
        attachedFiles: []
      });
    }
  }, [editingPrompt, open]);

  const updateFormField = <K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Handle file selection with validation
   * Validates file size (max 20MB) and total count (max 10 files)
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate files
    const validFiles = files.filter(file => {
      // Max 20MB per file
      if (file.size > 20 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: `${file.name} exceeds 20MB limit`
        });
        return false;
      }
      return true;
    });

    // Max 10 files total
    const currentTotal = formData.attachedFiles.length + validFiles.length;
    if (currentTotal > 10) {
      toast({
        variant: "destructive",
        title: "Too many files",
        description: "Maximum 10 files allowed per prompt"
      });
      return;
    }

    setFormData(prev => ({
      ...prev,
      attachedFiles: [...prev.attachedFiles, ...validFiles]
    }));
  };

  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachedFiles: prev.attachedFiles.filter((_, i) => i !== index)
    }));
  };

  /**
   * Upload file attachments to Supabase storage
   * Files are organized by prompt ID in the prompt-attachments bucket
   * 
   * @param promptId - The ID of the prompt to associate files with
   * @returns Array of uploaded file paths
   */
  const uploadAttachments = async (promptId: string): Promise<string[]> => {
    if (formData.attachedFiles.length === 0) return [];

    const uploadedPaths: string[] = [];

    for (const file of formData.attachedFiles) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${promptId}/${Date.now()}-${file.name}`;

        setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

        const { data, error } = await supabase.storage
          .from('prompt-attachments')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) throw error;

        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        uploadedPaths.push(data.path);
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        toast({
          variant: "destructive",
          title: "Upload failed",
          description: `Failed to upload ${file.name}`
        });
      }
    }

    return uploadedPaths;
  };

  /**
   * Validate form data before submission
   * Checks for required fields and length constraints
   * 
   * @returns true if validation passes, false otherwise
   */
  const validateForm = (): boolean => {
    // Title validation
    if (!formData.title.trim()) {
      toast({
        variant: "destructive",
        title: "Title required",
        description: "Please enter a title for your prompt"
      });
      return false;
    }

    if (formData.title.length > 200) {
      toast({
        variant: "destructive",
        title: "Title too long",
        description: "Title must be 200 characters or less"
      });
      return false;
    }

    // Prompt text validation
    if (!formData.promptText.trim()) {
      toast({
        variant: "destructive",
        title: "Prompt text required",
        description: "Please enter prompt text"
      });
      return false;
    }

    if (formData.promptText.length < 10) {
      toast({
        variant: "destructive",
        title: "Prompt too short",
        description: "Prompt text must be at least 10 characters"
      });
      return false;
    }

    // Category validation
    if (!formData.category) {
      toast({
        variant: "destructive",
        title: "Category required",
        description: "Please select a category"
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication required",
        description: "Please sign in to create prompts"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Find category ID
      const category = categories.find(c => c.name === formData.category);
      const categoryId = category?.id;

      // Prepare metadata
      const metadata: any = {
        category: formData.category,
        tags: formData.tags,
        translations: formData.translations,
        attached_files: []
      };

      // Create or update prompt
      const promptData: any = {
        title: formData.title,
        prompt_text: formData.promptText,
        category_id: categoryId,
        image_path: formData.thumbnail,
        metadata,
        user_id: user.id,
        prompt_type: 'text'
      };

      let promptId: string;

      if (editingPrompt) {
        // Update existing prompt
        const { data, error } = await supabase
          .from('prompts')
          .update(promptData)
          .eq('id', editingPrompt.id)
          .select()
          .single();

        if (error) throw error;
        promptId = data.id;

        toast({
          title: "Prompt updated",
          description: "Your prompt has been updated successfully"
        });
      } else {
        // Create new prompt
        const { data, error } = await supabase
          .from('prompts')
          .insert([promptData])
          .select()
          .single();

        if (error) throw error;
        promptId = data.id;

        toast({
          title: "Prompt created",
          description: "Your prompt has been created successfully"
        });
      }

      // Upload attachments if any
      if (formData.attachedFiles.length > 0) {
        const uploadedPaths = await uploadAttachments(promptId);
        
        // Update prompt with attachment metadata
        const attachmentMetadata = uploadedPaths.map((path, index) => ({
          name: formData.attachedFiles[index].name,
          path,
          size: formData.attachedFiles[index].size,
          type: formData.attachedFiles[index].type,
          uploadedAt: new Date().toISOString()
        }));

        await supabase
          .from('prompts')
          .update({
            metadata: {
              ...metadata,
              attached_files: attachmentMetadata
            }
          })
          .eq('id', promptId);
      }

      // Reset form and close
      onOpenChange(false);
      onSuccess?.();
      
      // Reset form data
      setFormData({
        title: "",
        promptText: "",
        category: "",
        tags: [],
        thumbnail: null,
        translations: {},
        attachedFiles: []
      });
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Failed to save prompt. Please try again."
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress({});
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl h-[90vh] flex flex-col p-0">
        <PromptDialogHeader isEditing={!!editingPrompt} />
        
        <ScrollArea className="flex-1 px-6">
          <div className="py-6 space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Enter prompt title..."
                value={formData.title}
                onChange={(e) => updateFormField("title", e.target.value)}
                maxLength={200}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                {formData.title.length}/200 characters
              </p>
            </div>

            <Separator />

            {/* Prompt Text */}
            <div className="space-y-2">
              <Label htmlFor="promptText" className="text-sm font-medium">
                Prompt Text <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="promptText"
                placeholder="Enter your prompt text here..."
                value={formData.promptText}
                onChange={(e) => updateFormField("promptText", e.target.value)}
                rows={6}
                disabled={isSubmitting}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 10 characters
              </p>
            </div>

            <Separator />

            {/* Translation */}
            <TranslationButtons
              text={formData.promptText}
              onTranslated={(translatedText) => updateFormField("promptText", translatedText)}
              onTranslationStored={(translations) => {
                // Convert from simple strings to proper translation objects
                const formattedTranslations: FormData['translations'] = {};
                if (translations.arabic) {
                  formattedTranslations.arabic = { prompt_text: translations.arabic };
                }
                if (translations.english) {
                  formattedTranslations.english = { prompt_text: translations.english };
                }
                updateFormField("translations", formattedTranslations);
              }}
            />

            <Separator />

            {/* Category */}
            <CategorySelector
              value={formData.category}
              onChange={(value) => updateFormField("category", value)}
            />

            <Separator />

            {/* Tags */}
            <TagsManager
              promptText={formData.promptText}
              tags={formData.tags}
              onChange={(tags) => updateFormField("tags", tags)}
            />

            <Separator />

            {/* Thumbnail */}
            <ThumbnailManager
              value={formData.thumbnail}
              onChange={(value) => updateFormField("thumbnail", value)}
            />

            <Separator />

            {/* File Attachments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Attached Files</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload files for lifetime plan members to download
                  </p>
                </div>
                <Badge variant="outline" className="text-warm-gold border-warm-gold">
                  Lifetime Plan Feature
                </Badge>
              </div>

              {/* File Upload */}
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  disabled={isSubmitting || formData.attachedFiles.length >= 10}
                />
                <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-2">Upload attachments</p>
                <p className="text-xs text-muted-foreground mb-4">
                  PDF, JSON, TXT, ZIP up to 20MB per file (Max 10 files)
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={isSubmitting || formData.attachedFiles.length >= 10}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Choose Files
                </Button>
              </div>

              {/* Attached Files List */}
              {formData.attachedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Selected files ({formData.attachedFiles.length}/10)
                  </p>
                  {formData.attachedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="h-4 w-4 text-warm-gold flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                            {uploadProgress[file.name] !== undefined && 
                              ` - ${uploadProgress[file.name]}%`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        disabled={isSubmitting}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 p-6 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="mobile-button-primary"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {editingPrompt ? "Updating..." : "Creating..."}
              </>
            ) : (
              editingPrompt ? "Update Prompt" : "Create Prompt"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

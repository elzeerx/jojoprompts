import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { type PromptRow } from "@/types";
import { DialogForm } from "./components/DialogForm";
import { usePromptForm } from "./hooks/usePromptForm";
import { useAuth } from "@/contexts/AuthContext";

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingPrompt?: PromptRow | null;
  promptType?: 'text' | 'image' | 'workflow' | 'video' | 'sound';
  category?: string;
}

export function PromptDialog({ open, onOpenChange, onSuccess, editingPrompt, promptType, category }: PromptDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [currentFiles, setCurrentFiles] = useState<File[]>([]);
  const { user } = useAuth();
  
  const {
    formData,
    setFormData,
    resetForm,
    validateForm
  } = usePromptForm(editingPrompt);

  // Initialize promptType and category if provided
  useEffect(() => {
    if (promptType && !editingPrompt) {
      setFormData(prev => ({
        ...prev,
        promptType: promptType as 'text' | 'image' | 'workflow' | 'video' | 'sound',
        metadata: {
          ...prev.metadata,
          category: category || prev.metadata?.category
        }
      }));
    }
  }, [promptType, category, setFormData, editingPrompt]);

  useEffect(() => {
    if (!open) {
      resetForm();
      setCurrentFile(null);
      setCurrentFiles([]);
    }
  }, [open, resetForm]);

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const uploadedPaths: string[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('prompt-images')
        .upload(fileName, file);
        
      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }
      
      uploadedPaths.push(fileName);
    }
    
    return uploadedPaths;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      let imagePath = formData.imagePath;
      let mediaFiles = formData.metadata?.media_files || [];
      
      // Upload legacy single file if exists
      if (currentFile) {
        const fileExt = currentFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('prompt-images')
          .upload(fileName, currentFile);
          
        if (uploadError) throw uploadError;
        imagePath = fileName;
      }

      // Upload multiple media files
      if (currentFiles.length > 0) {
        const uploadedPaths = await uploadFiles(currentFiles);
        
        // Update media files with uploaded paths
        const updatedMediaFiles = mediaFiles.map((media: any, index: number) => {
          if (media.file && uploadedPaths[index]) {
            return {
              type: media.type,
              path: uploadedPaths[index],
              name: media.name
            };
          }
          return {
            type: media.type,
            path: media.path,
            name: media.name
          };
        });
        
        mediaFiles = updatedMediaFiles;
      } else {
        // Clean existing media files to remove non-serializable properties
        mediaFiles = mediaFiles.map((media: any) => ({
          type: media.type,
          path: media.path,
          name: media.name
        }));
      }

      // Prepare metadata as JSON-compatible object - serialize everything properly
      const cleanMetadata = JSON.parse(JSON.stringify({
        category: formData.metadata?.category || 'ChatGPT',
        tags: formData.metadata?.tags || [],
        style: formData.metadata?.style || '',
        target_model: formData.metadata?.target_model || '',
        use_case: formData.metadata?.use_case || '',
        media_files: mediaFiles
      }));

      const promptData = {
        title: formData.title,
        prompt_text: formData.promptText,
        prompt_type: formData.promptType,
        image_path: imagePath,
        default_image_path: formData.defaultImagePath,
        metadata: cleanMetadata,
        user_id: user?.id || ""
      };

      if (editingPrompt) {
        const { error } = await supabase
          .from("prompts")
          .update(promptData)
          .eq("id", editingPrompt.id);
          
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Prompt updated successfully"
        });
      } else {
        const { error } = await supabase
          .from("prompts")
          .insert(promptData);
          
        if (error) throw error;
        
        toast({
          title: "Success", 
          description: "Prompt created successfully"
        });
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast({
        title: "Error",
        description: "Failed to save prompt",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'chatgpt':
        return '#c49d68';
      case 'midjourney':
        return '#7a9e9f';
      case 'workflow':
        return '#8b7fb8';
      default:
        return '#c49d68';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="prompt-dialog w-full max-w-4xl h-[90vh] flex flex-col p-0">
        {/* Fixed Header */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          {formData.metadata?.category && (
            <span 
              className="inline-block rounded-lg text-white px-3 py-1 text-xs font-medium mb-3"
              style={{ backgroundColor: getCategoryColor(formData.metadata.category) }}
            >
              {formData.metadata.category}
            </span>
          )}
          <DialogHeader className="text-left p-0">
            <DialogTitle className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
              {editingPrompt ? "Edit Prompt" : "Create New Prompt"}
            </DialogTitle>
          </DialogHeader>
        </div>
        
        {/* Scrollable Content */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-white/40 p-4 sm:p-6 rounded-xl border border-gray-200">
                <DialogForm
                  formData={formData}
                  onChange={setFormData}
                  onFileChange={setCurrentFile}
                  onMultipleFilesChange={setCurrentFiles}
                />
              </div>
              
              {/* Fixed Footer Buttons */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 pb-2">
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
                  className="bg-[#c49d68] hover:bg-[#c49d68]/90 text-white px-6 py-3 text-base font-semibold rounded-xl shadow-md order-1 sm:order-2"
                >
                  {isSubmitting 
                    ? (editingPrompt ? "Updating..." : "Creating...") 
                    : (editingPrompt ? "Update Prompt" : "Create Prompt")
                  }
                </Button>
              </div>
            </form>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

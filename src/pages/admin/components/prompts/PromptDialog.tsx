
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { type PromptRow } from "@/types";
import { DialogForm } from "./components/DialogForm";
import { usePromptForm } from "./hooks/usePromptForm";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, FileImage, GalleryVertical, ImagePlus } from "lucide-react";

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingPrompt?: PromptRow | null;
  // Optional props
  promptType?: 'text' | 'image' | 'button' | 'image-selection' | 'workflow';
  category?: string;
  // New prop to show type selection UI
  showTypeSelection?: boolean;
}

export function PromptDialog({ 
  open, 
  onOpenChange, 
  onSuccess, 
  editingPrompt, 
  promptType: initialPromptType,
  category: initialCategory,
  showTypeSelection = false
}: PromptDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const {
    formData,
    setFormData,
    resetForm,
    validateForm
  } = usePromptForm(editingPrompt);

  // Initialize promptType and category if provided
  useEffect(() => {
    if ((initialPromptType || selectedType) && !editingPrompt) {
      const typeToUse = selectedType || initialPromptType;
      const categoryToUse = selectedCategory || initialCategory;
      
      setFormData(prev => ({
        ...prev,
        promptType: typeToUse,
        metadata: {
          ...prev.metadata,
          category: categoryToUse || prev.metadata?.category
        }
      }));
    }
  }, [initialPromptType, initialCategory, selectedType, selectedCategory, setFormData, editingPrompt]);

  useEffect(() => {
    if (!open) {
      resetForm();
      setCurrentFile(null);
      setSelectedType(null);
      setSelectedCategory(null);
    }
  }, [open, resetForm]);

  const handleTypeSelection = (type: string, category: string) => {
    setSelectedType(type as any);
    setSelectedCategory(category);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      let imagePath = formData.imagePath;
      
      if (currentFile) {
        const fileExt = currentFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('prompt-images')
          .upload(fileName, currentFile);
          
        if (uploadError) throw uploadError;
        imagePath = fileName;
      }

      const promptData = {
        title: formData.title,
        prompt_text: formData.promptText,
        prompt_type: formData.promptType,
        image_path: imagePath,
        default_image_path: formData.defaultImagePath,
        metadata: formData.metadata,
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
      case 'n8n':
        return '#8b7fb8';
      default:
        return '#c49d68';
    }
  };

  // Render type selection UI or prompt form based on whether a type has been selected
  const shouldShowTypeSelection = showTypeSelection && !selectedType && !editingPrompt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="prompt-dialog">
        <div className="p-8">
          {/* Header */}
          <div className="mb-6">
            {formData.metadata?.category && !shouldShowTypeSelection && (
              <span 
                className="inline-block rounded-lg text-white px-3 py-1 text-xs font-medium mb-3"
                style={{ backgroundColor: getCategoryColor(formData.metadata.category) }}
              >
                {formData.metadata.category}
              </span>
            )}
            <DialogHeader className="text-left p-0">
              <DialogTitle className="text-3xl font-bold text-gray-900 leading-tight">
                {editingPrompt ? "Edit Prompt" : "Create New Prompt"}
              </DialogTitle>
            </DialogHeader>
          </div>
          
          {shouldShowTypeSelection ? (
            <div className="space-y-8">
              {/* ChatGPT section */}
              <div>
                <h3 className="font-medium text-warm-gold mb-4">ChatGPT</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="flex items-center justify-start gap-3 h-16 hover:border-warm-gold/50 hover:bg-warm-gold/5 transition-all"
                    onClick={() => handleTypeSelection("text", "ChatGPT")}
                  >
                    <MessageSquare className="h-5 w-5 text-warm-gold" />
                    <span>Add Text Prompt</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="flex items-center justify-start gap-3 h-16 hover:border-warm-gold/50 hover:bg-warm-gold/5 transition-all"
                    onClick={() => handleTypeSelection("image", "ChatGPT")}
                  >
                    <FileImage className="h-5 w-5 text-warm-gold" />
                    <span>Add Image Prompt</span>
                  </Button>
                </div>
              </div>
              
              {/* Midjourney section */}
              <div>
                <h3 className="font-medium text-muted-teal mb-4">Midjourney</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="flex items-center justify-start gap-3 h-16 hover:border-muted-teal/50 hover:bg-muted-teal/5 transition-all"
                    onClick={() => handleTypeSelection("image-selection", "Midjourney")}
                  >
                    <GalleryVertical className="h-5 w-5 text-muted-teal" />
                    <span>Add Image Selection</span>
                  </Button>
                </div>
              </div>
              
              {/* n8n section */}
              <div>
                <h3 className="font-medium text-secondary mb-4">n8n</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="flex items-center justify-start gap-3 h-16 hover:border-secondary/50 hover:bg-secondary/5 transition-all"
                    onClick={() => handleTypeSelection("workflow", "n8n")}
                  >
                    <ImagePlus className="h-5 w-5 text-secondary" />
                    <span>Add Workflow</span>
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="px-6 py-3 text-base font-semibold rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-white/40 p-6 rounded-xl border border-gray-200">
                <DialogForm
                  formData={formData}
                  onChange={setFormData}
                  onFileChange={setCurrentFile}
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="px-6 py-3 text-base font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#c49d68] hover:bg-[#c49d68]/90 text-white px-6 py-3 text-base font-semibold rounded-xl shadow-md"
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
      </DialogContent>
    </Dialog>
  );
}

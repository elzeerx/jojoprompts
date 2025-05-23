
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { type PromptRow } from "@/types";
import { DialogForm } from "./components/DialogForm";
import { usePromptForm } from "./hooks/usePromptForm";
import { useAuth } from "@/contexts/AuthContext";
import { X } from "lucide-react";

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingPrompt?: PromptRow | null;
}

export function PromptDialog({ open, onOpenChange, onSuccess, editingPrompt }: PromptDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const { user } = useAuth();
  
  const {
    formData,
    setFormData,
    resetForm,
    validateForm
  } = usePromptForm(editingPrompt);

  useEffect(() => {
    if (!open) {
      resetForm();
      setCurrentFile(null);
    }
  }, [open, resetForm]);

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
        return '#8b7fb8';
      default:
        return '#c49d68';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 border-none bg-[#efeee9] rounded-2xl shadow-xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-6 right-6 z-10 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>

        <div className="p-8">
          {/* Header */}
          <div className="mb-6">
            {formData.metadata?.category && (
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

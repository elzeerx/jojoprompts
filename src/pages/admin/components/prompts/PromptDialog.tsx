
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
      
      // Handle image upload if there's a new file
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingPrompt ? "Edit Prompt" : "Create New Prompt"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogForm
            formData={formData}
            onChange={setFormData}
            onFileChange={setCurrentFile}
          />
          
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-warm-gold hover:bg-warm-gold/90"
            >
              {isSubmitting 
                ? (editingPrompt ? "Updating..." : "Creating...") 
                : (editingPrompt ? "Update Prompt" : "Create Prompt")
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

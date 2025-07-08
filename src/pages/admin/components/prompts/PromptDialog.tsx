import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { IMAGE_BUCKET, VIDEO_BUCKET, AUDIO_BUCKET, FILE_BUCKET } from "@/utils/buckets";
import { toast } from "@/hooks/use-toast";
import { type PromptRow } from "@/types";
import { DialogForm } from "./components/DialogForm";
import { usePromptForm } from "./hooks/usePromptForm";
import { useAuth } from "@/contexts/AuthContext";
import { usePromptSubmission } from "./hooks/usePromptSubmission";
import { uploadFiles } from "./hooks/useFileUpload";
import { getCategoryColor } from "./utils/categoryUtils";

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
  const { user } = useAuth();
  
  const {
    formData,
    setFormData,
    resetForm,
    validateForm
  } = usePromptForm(editingPrompt);

  console.log("PromptDialog - Dialog opened with editingPrompt:", editingPrompt?.id);
  console.log("PromptDialog - Current form data:", formData);

  // Initialize promptType and category for new prompts
  useEffect(() => {
    if (promptType && !editingPrompt && open) {
      console.log("PromptDialog - Setting initial prompt type and category for new prompt:", promptType, category);
      setFormData(prev => ({
        ...prev,
        promptType: promptType as 'text' | 'image' | 'workflow' | 'video' | 'sound',
        metadata: {
          ...prev.metadata,
          category: category || prev.metadata?.category || 'ChatGPT'
        }
      }));
    }
  }, [promptType, category, setFormData, editingPrompt, open]);

  // Reset auxiliary state when dialog closes
  useEffect(() => {
    if (!open) {
      console.log("PromptDialog - Dialog closed, resetting auxiliary state");
      setCurrentFile(null);
      setCurrentFiles([]);
      setWorkflowFiles([]);
    }
  }, [open]);

  const { isSubmitting, handleSubmit } = usePromptSubmission({
    onSuccess,
    onOpenChange,
    editingPrompt,
  });

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
              style={{ backgroundColor: getCategoryColor(formData.metadata.category as string) }}
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
            <form
              onSubmit={e =>
                handleSubmit(
                  e,
                  formData,
                  validateForm,
                  currentFile,
                  currentFiles,
                  workflowFiles
                )
              }
              className="space-y-6"
            >
              <div className="bg-white/40 p-4 sm:p-6 rounded-xl border border-gray-200">
                <DialogForm
                  formData={formData}
                  onChange={setFormData}
                  onFileChange={setCurrentFile}
                  onMultipleFilesChange={setCurrentFiles}
                  onWorkflowFilesChange={setWorkflowFiles}
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

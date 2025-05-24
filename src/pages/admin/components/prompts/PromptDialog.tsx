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

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingPrompt?: PromptRow | null;
  promptType?: 'text' | 'image' | 'workflow' | 'video' | 'sound';
  category?: string;
}

// Type for metadata to properly handle the Json type from Supabase
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
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      setWorkflowFiles([]);
    }
  }, [open, resetForm]);

  const uploadFiles = async (files: File[], bucket?: string): Promise<string[]> => {
    const uploadedPaths: string[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      let targetBucket = bucket;
      if (!targetBucket) {
        if (file.type.startsWith('video/')) targetBucket = VIDEO_BUCKET;
        else if (file.type.startsWith('audio/')) targetBucket = AUDIO_BUCKET;
        else targetBucket = IMAGE_BUCKET;
      }

      const { error: uploadError } = await supabase.storage
        .from(targetBucket)
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
    
    console.log("PromptDialog - Starting form submission with data:", formData);
    console.log("PromptDialog - Form metadata before processing:", formData.metadata);
    console.log("PromptDialog - Current workflow files to upload:", workflowFiles);
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      let imagePath = formData.imagePath;
      const metadata = formData.metadata as PromptMetadata;
      let mediaFiles = metadata?.media_files || [];
      let workflowFilesData = metadata?.workflow_files || [];
      
      // Upload legacy single file if exists
      if (currentFile) {
        const fileExt = currentFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from(IMAGE_BUCKET)
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

      // Upload workflow files
      if (workflowFiles.length > 0) {
        console.log("PromptDialog - Uploading workflow files:", workflowFiles);
        const uploadedWorkflowPaths = await uploadFiles(workflowFiles, FILE_BUCKET);

        // Create workflow files data with uploaded paths
        const newWorkflowFiles = workflowFiles.map((file, index) => {
          const fileExt = file.name.split('.').pop()?.toLowerCase() as 'json' | 'zip';
          return {
            type: fileExt,
            path: uploadedWorkflowPaths[index],
            name: file.name
          };
        });

        // Filter out any existing entries without a valid path before merging
        const existingFiles = Array.isArray(workflowFilesData) ? workflowFilesData.filter((wf: any) => wf.path) : [];

        // Merge with existing workflow files (keep existing ones, add new ones)
        workflowFilesData = [...existingFiles, ...newWorkflowFiles];
        console.log("PromptDialog - Final workflow files data:", workflowFilesData);
      } else {
        // Clean existing workflow files to remove non-serializable properties
        workflowFilesData = Array.isArray(workflowFilesData) ? workflowFilesData.map((wf: any) => ({
          type: wf.type,
          path: wf.path,
          name: wf.name
        })) : [];
      }

      // Prepare metadata as JSON-compatible object - serialize everything properly
      const cleanMetadata = JSON.parse(JSON.stringify({
        category: metadata?.category || 'ChatGPT',
        tags: metadata?.tags || [],
        style: metadata?.style || '',
        target_model: metadata?.target_model || '',
        use_case: metadata?.use_case || '',
        media_files: mediaFiles,
        workflow_files: workflowFilesData,
        workflow_steps: metadata?.workflow_steps || []
      }));

      console.log("PromptDialog - Clean metadata prepared for saving:", cleanMetadata);
      console.log("PromptDialog - Workflow files in metadata:", cleanMetadata.workflow_files);

      const promptData = {
        title: formData.title,
        prompt_text: formData.promptText,
        prompt_type: formData.promptType,
        image_path: imagePath,
        default_image_path: formData.defaultImagePath,
        metadata: cleanMetadata,
        user_id: user?.id || ""
      };

      console.log("PromptDialog - Final prompt data being saved:", promptData);

      if (editingPrompt) {
        const { data, error } = await supabase
          .from("prompts")
          .update(promptData)
          .eq("id", editingPrompt.id)
          .select();
          
        if (error) throw error;
        
        console.log("PromptDialog - Updated prompt data returned:", data);
        
        // Type cast the returned metadata for safe access
        const returnedMetadata = data?.[0]?.metadata as PromptMetadata;
        console.log("PromptDialog - Updated prompt workflow files:", returnedMetadata?.workflow_files);
        
        toast({
          title: "Success",
          description: "Prompt updated successfully"
        });
      } else {
        const { data, error } = await supabase
          .from("prompts")
          .insert(promptData)
          .select();
          
        if (error) throw error;
        
        console.log("PromptDialog - Inserted prompt data returned:", data);
        
        // Type cast the returned metadata for safe access
        const returnedMetadata = data?.[0]?.metadata as PromptMetadata;
        console.log("PromptDialog - Inserted prompt workflow files:", returnedMetadata?.workflow_files);
        
        toast({
          title: "Success", 
          description: "Prompt created successfully"
        });
      }
      
      console.log("PromptDialog - Calling onSuccess to refresh data");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("PromptDialog - Error saving prompt:", error);
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
            <form onSubmit={handleSubmit} className="space-y-6">
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


import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { uploadFiles } from "./useFileUpload";
import { IMAGE_BUCKET, FILE_BUCKET } from "@/utils/buckets";
import { type PromptRow } from "@/types";

interface UsePromptSubmissionProps {
  onSuccess: () => void;
  onOpenChange: (open: boolean) => void;
  editingPrompt: PromptRow | null | undefined;
}

export function usePromptSubmission({
  onSuccess,
  onOpenChange,
  editingPrompt
}: UsePromptSubmissionProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (
    e: React.FormEvent,
    formData: any,
    validateForm: () => boolean,
    currentFile: File | null,
    currentFiles: File[],
    workflowFiles: File[],
  ) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      let imagePath = formData.imagePath;
      const metadata = formData.metadata;
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
        mediaFiles = mediaFiles.map((media: any) => ({
          type: media.type,
          path: media.path,
          name: media.name
        }));
      }

      // Upload workflow files
      if (workflowFiles.length > 0) {
        const uploadedWorkflowPaths = await uploadFiles(workflowFiles, FILE_BUCKET);
        const newWorkflowFiles = workflowFiles.map((file, index) => {
          const fileExt = file.name.split('.').pop()?.toLowerCase() as 'json' | 'zip';
          return {
            type: fileExt,
            path: uploadedWorkflowPaths[index],
            name: file.name
          };
        });
        const existingFiles = Array.isArray(workflowFilesData) ? workflowFilesData.filter((wf: any) => wf.path) : [];
        workflowFilesData = [...existingFiles, ...newWorkflowFiles];
      } else {
        workflowFilesData = Array.isArray(workflowFilesData) ? workflowFilesData.map((wf: any) => ({
          type: wf.type,
          path: wf.path,
          name: wf.name
        })) : [];
      }

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
          .eq("id", editingPrompt.id)
          .select();
        if (error) throw error;
        toast({
          title: "Success",
          description: "Prompt updated successfully"
        });
      } else {
        const { error } = await supabase
          .from("prompts")
          .insert(promptData)
          .select();
        if (error) throw error;
        toast({
          title: "Success", 
          description: "Prompt created successfully"
        });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save prompt",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return { isSubmitting, handleSubmit };
}

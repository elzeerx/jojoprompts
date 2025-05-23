
import { useState, useCallback } from "react";
import { type PromptRow } from "@/types";
import { toast } from "@/hooks/use-toast";

interface FormData {
  title: string;
  promptText: string;
  promptType: string;
  imagePath?: string;
  defaultImagePath?: string;
  metadata: {
    category?: string;
    style?: string;
    tags?: string[];
    target_model?: string;
    use_case?: string;
    button_text?: string;
    button_action?: string;
    image_options?: string[];
    workflow_steps?: Array<{
      id: string;
      name: string;
      description: string;
      type: string;
    }>;
  };
}

export function usePromptForm(editingPrompt?: PromptRow | null) {
  const [formData, setFormData] = useState<FormData>({
    title: editingPrompt?.title || "",
    promptText: editingPrompt?.prompt_text || "",
    promptType: editingPrompt?.prompt_type || "text",
    imagePath: editingPrompt?.image_path || "",
    defaultImagePath: editingPrompt?.default_image_path || "",
    metadata: {
      category: editingPrompt?.metadata?.category || "ChatGPT",
      style: editingPrompt?.metadata?.style || "",
      tags: editingPrompt?.metadata?.tags || [],
      target_model: editingPrompt?.metadata?.target_model || "ChatGPT",
      use_case: editingPrompt?.metadata?.use_case || "",
      button_text: editingPrompt?.metadata?.button_text || "",
      button_action: editingPrompt?.metadata?.button_action || "",
      image_options: editingPrompt?.metadata?.image_options || [],
      workflow_steps: editingPrompt?.metadata?.workflow_steps || []
    }
  });

  const resetForm = useCallback(() => {
    setFormData({
      title: "",
      promptText: "",
      promptType: "text",
      imagePath: "",
      defaultImagePath: "",
      metadata: {
        category: "ChatGPT",
        style: "",
        tags: [],
        target_model: "ChatGPT",
        use_case: "",
        button_text: "",
        button_action: "",
        image_options: [],
        workflow_steps: []
      }
    });
  }, []);

  const validateForm = useCallback(() => {
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required",
        variant: "destructive"
      });
      return false;
    }

    if (!formData.promptText.trim()) {
      toast({
        title: "Validation Error", 
        description: "Prompt text is required",
        variant: "destructive"
      });
      return false;
    }

    return true;
  }, [formData]);

  return {
    formData,
    setFormData,
    resetForm,
    validateForm
  };
}

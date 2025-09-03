
import { useState, useCallback, useEffect } from "react";
import { type PromptRow, type LocalePrompt } from "@/types";
import { toast } from "@/hooks/use-toast";

interface MediaFile {
  type: 'image' | 'video' | 'audio';
  path: string;
  name: string;
  file?: File;
  preview?: string;
}

interface WorkflowFile {
  type: 'json' | 'zip';
  path: string;
  name: string;
}

interface FormData {
  title: string;
  promptText: string;
  // Bilingual fields for admins/prompters
  titleEnglish?: string;
  titleArabic?: string;
  promptTextEnglish?: string;
  promptTextArabic?: string;
  promptType: "text" | "image" | "workflow" | "video" | "sound" | "button" | "image-selection";
  imagePath: string;
  defaultImagePath: string;
  metadata: {
    category: string;
    tags: string[];
    style?: string;
    target_model?: string;
    use_case?: string;
    buttons?: Array<{ id: string; name: string; description: string; type: string }>;
    media_files?: MediaFile[];
    workflow_files?: WorkflowFile[];
    workflow_steps?: Array<{ name: string; description: string; type?: string }>;
    translations?: {
      english?: LocalePrompt;
      arabic?: LocalePrompt;
    };
  };
}

export function usePromptForm(editingPrompt?: PromptRow | null) {
  const [formData, setFormData] = useState<FormData>(() => {
    if (editingPrompt) {
      console.log("usePromptForm - Initial form data from editing prompt:", editingPrompt.metadata);
      const translations = editingPrompt.metadata?.translations || {};
      return {
        title: editingPrompt.title || "",
        promptText: editingPrompt.prompt_text || "",
        // Extract bilingual fields from translations
        titleEnglish: translations.english?.title || "",
        titleArabic: translations.arabic?.title || "",
        promptTextEnglish: translations.english?.prompt_text || "",
        promptTextArabic: translations.arabic?.prompt_text || "",
        promptType: editingPrompt.prompt_type || "text",
        imagePath: editingPrompt.image_path || "",
        defaultImagePath: editingPrompt.default_image_path || "",
        metadata: {
          category: editingPrompt.metadata?.category || "ChatGPT",
          tags: editingPrompt.metadata?.tags || [],
          style: editingPrompt.metadata?.style || "",
          target_model: editingPrompt.metadata?.target_model || "",
          use_case: editingPrompt.metadata?.use_case || "",
          buttons: editingPrompt.metadata?.buttons || [],
          media_files: editingPrompt.metadata?.media_files || [],
          workflow_files: editingPrompt.metadata?.workflow_files || [],
          workflow_steps: editingPrompt.metadata?.workflow_steps || [],
          translations: translations
        }
      };
    }
    
    return {
      title: "",
      promptText: "",
      titleEnglish: "",
      titleArabic: "",
      promptTextEnglish: "",
      promptTextArabic: "",
      promptType: "text",
      imagePath: "",
      defaultImagePath: "",
      metadata: {
        category: "ChatGPT",
        tags: [],
        style: "",
        target_model: "",
        use_case: "",
        buttons: [],
        media_files: [],
        workflow_files: [],
        workflow_steps: [],
        translations: {}
      }
    };
  });

  // Handle editingPrompt changes - this fixes the double-click edit issue
  useEffect(() => {
    if (editingPrompt) {
      console.log("usePromptForm - Editing prompt changed, updating form data:", editingPrompt.metadata);
      const translations = editingPrompt.metadata?.translations || {};
      setFormData({
        title: editingPrompt.title || "",
        promptText: editingPrompt.prompt_text || "",
        titleEnglish: translations.english?.title || "",
        titleArabic: translations.arabic?.title || "",
        promptTextEnglish: translations.english?.prompt_text || "",
        promptTextArabic: translations.arabic?.prompt_text || "",
        promptType: editingPrompt.prompt_type || "text",
        imagePath: editingPrompt.image_path || "",
        defaultImagePath: editingPrompt.default_image_path || "",
        metadata: {
          category: editingPrompt.metadata?.category || "ChatGPT",
          tags: editingPrompt.metadata?.tags || [],
          style: editingPrompt.metadata?.style || "",
          target_model: editingPrompt.metadata?.target_model || "",
          use_case: editingPrompt.metadata?.use_case || "",
          buttons: editingPrompt.metadata?.buttons || [],
          media_files: editingPrompt.metadata?.media_files || [],
          workflow_files: editingPrompt.metadata?.workflow_files || [],
          workflow_steps: editingPrompt.metadata?.workflow_steps || [],
          translations: translations
        }
      });
    }
  }, [editingPrompt]);

  const resetForm = useCallback(() => {
    console.log("usePromptForm - Resetting form");
    setFormData({
      title: "",
      promptText: "",
      titleEnglish: "",
      titleArabic: "",
      promptTextEnglish: "",
      promptTextArabic: "",
      promptType: "text",
      imagePath: "",
      defaultImagePath: "",
      metadata: {
        category: "ChatGPT",
        tags: [],
        style: "",
        target_model: "",
        use_case: "",
        buttons: [],
        media_files: [],
        workflow_files: [],
        workflow_steps: [],
        translations: {}
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

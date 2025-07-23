import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Model {
  id: string;
  name: string;
  type: "image" | "video";
  parameters: Record<string, any>;
  is_active: boolean;
}

interface Field {
  id: string;
  field_category: "style" | "subject" | "effects";
  field_name: string;
  field_type: "dropdown" | "text" | "textarea" | "multiselect";
  options: string[];
  is_active: boolean;
  display_order: number;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  template_data: Record<string, any>;
  model_type: "image" | "video";
  is_public: boolean;
  created_by: string;
}

export function usePromptGenerator() {
  const { user } = useAuth();
  const [models, setModels] = useState<Model[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchModels = async () => {
    try {
      const { data, error } = await supabase
        .from("prompt_generator_models")
        .select("*")
        .order("name");

      if (error) throw error;
      setModels((data || []).map(item => ({
        ...item,
        type: item.type as "image" | "video",
        parameters: item.parameters as Record<string, any>
      })));
    } catch (error) {
      console.error("Error fetching models:", error);
    }
  };

  const fetchFields = async () => {
    try {
      const { data, error } = await supabase
        .from("prompt_generator_fields")
        .select("*")
        .order("field_category, display_order, field_name");

      if (error) throw error;
      setFields((data || []).map(item => ({
        ...item,
        field_category: item.field_category as "style" | "subject" | "effects",
        field_type: item.field_type as "dropdown" | "text" | "textarea" | "multiselect",
        options: Array.isArray(item.options) ? item.options as string[] : []
      })));
    } catch (error) {
      console.error("Error fetching fields:", error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("prompt_generator_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates((data || []).map(item => ({
        ...item,
        model_type: item.model_type as "image" | "video",
        template_data: item.template_data as Record<string, any>
      })));
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const generatePrompt = async (formData: any) => {
    setLoading(true);
    try {
      const selectedModel = models.find(m => m.id === formData.selectedModel);
      if (!selectedModel) {
        throw new Error("Model not found");
      }

      // Generate prompt based on model type and data
      let prompt = "";
      const promptParts: string[] = [];

      // Add style elements
      if (formData.style) {
        Object.entries(formData.style).forEach(([key, value]) => {
          if (value) {
            promptParts.push(String(value));
          }
        });
      }

      // Add subject description
      if (formData.customPrompt) {
        promptParts.push(formData.customPrompt);
      }

      // Add subject elements
      if (formData.subject) {
        Object.entries(formData.subject).forEach(([key, value]) => {
          if (value && Array.isArray(value)) {
            promptParts.push(...value);
          } else if (value) {
            promptParts.push(String(value));
          }
        });
      }

      // Add effects
      if (formData.effects) {
        Object.entries(formData.effects).forEach(([key, value]) => {
          if (value) {
            promptParts.push(String(value));
          }
        });
      }

      prompt = promptParts.join(", ");

      // Add model-specific parameters for Midjourney
      if (selectedModel.name.toLowerCase().includes("midjourney") && formData.modelParameters) {
        const params: string[] = [];
        
        if (formData.modelParameters.aspect_ratio) {
          params.push(`--ar ${formData.modelParameters.aspect_ratio}`);
        }
        if (formData.modelParameters.stylize !== undefined) {
          params.push(`--stylize ${formData.modelParameters.stylize}`);
        }
        if (formData.modelParameters.chaos !== undefined) {
          params.push(`--chaos ${formData.modelParameters.chaos}`);
        }
        if (formData.modelParameters.version) {
          params.push(`--v ${formData.modelParameters.version}`);
        }
        if (formData.modelParameters.style) {
          params.push(`--style ${formData.modelParameters.style}`);
        }

        if (params.length > 0) {
          prompt += " " + params.join(" ");
        }
      }

      const promptData = {
        model: selectedModel.name,
        modelType: formData.modelType,
        prompt: prompt,
        parameters: formData.modelParameters || {},
        timestamp: new Date().toISOString(),
        formData: formData
      };

      return {
        prompt,
        data: promptData
      };
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async (templateData: Omit<Template, "id" | "created_by">) => {
    try {
      const { error } = await supabase
        .from("prompt_generator_templates")
        .insert({
          ...templateData,
          created_by: user?.id
        });

      if (error) throw error;
      await fetchTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      throw error;
    }
  };

  const addModel = async (modelData: Omit<Model, "id">) => {
    try {
      const { error } = await supabase
        .from("prompt_generator_models")
        .insert({
          ...modelData,
          created_by: user?.id
        });

      if (error) throw error;
      await fetchModels();
    } catch (error) {
      console.error("Error adding model:", error);
      throw error;
    }
  };

  const updateModel = async (id: string, modelData: Partial<Model>) => {
    try {
      const { error } = await supabase
        .from("prompt_generator_models")
        .update(modelData)
        .eq("id", id);

      if (error) throw error;
      await fetchModels();
    } catch (error) {
      console.error("Error updating model:", error);
      throw error;
    }
  };

  const deleteModel = async (id: string) => {
    try {
      const { error } = await supabase
        .from("prompt_generator_models")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await fetchModels();
    } catch (error) {
      console.error("Error deleting model:", error);
      throw error;
    }
  };

  const addFieldOption = async (fieldId: string, newOption: string) => {
    try {
      // First get the current field
      const { data: field, error: fetchError } = await supabase
        .from("prompt_generator_fields")
        .select("options")
        .eq("id", fieldId)
        .single();

      if (fetchError) throw fetchError;

      const currentOptions = Array.isArray(field.options) ? field.options as string[] : [];
      const updatedOptions = [...currentOptions, newOption];

      const { error } = await supabase
        .from("prompt_generator_fields")
        .update({ options: updatedOptions })
        .eq("id", fieldId);

      if (error) throw error;
      await fetchFields();
    } catch (error) {
      console.error("Error adding field option:", error);
      throw error;
    }
  };

  useEffect(() => {
    fetchModels();
    fetchFields();
    fetchTemplates();
  }, []);

  return {
    models,
    fields,
    templates,
    loading,
    generatePrompt,
    saveTemplate,
    addModel,
    updateModel,
    deleteModel,
    addFieldOption,
    refetch: () => {
      fetchModels();
      fetchFields();
      fetchTemplates();
    }
  };
}
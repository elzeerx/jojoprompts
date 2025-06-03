
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { type Prompt } from "@/types";
import { useCategories } from "@/hooks/useCategories";

export function usePromptsData({ authLoading, session }: { authLoading: boolean; session: any }) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<string[]>(["all"]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch active categories from database
  const { categories: dbCategories, loading: categoriesLoading } = useCategories();
  const activeCategories = dbCategories.filter(cat => cat.is_active);

  const fetchPrompts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const transformedData = (data ?? []).map((item) => {
        // Ensure metadata is always an object
        const metadata = typeof item.metadata === 'object' && item.metadata !== null 
          ? item.metadata 
          : {};
          
        // Get category from metadata if it exists, otherwise use default
        const metadataObj = metadata as Record<string, any>;
        const category = metadataObj.category || "";
        
        // Check if category exists in active categories list
        const categoryExists = activeCategories.some(cat => cat.name === category);
        const validCategory = categoryExists ? category : "ChatGPT"; // Default to ChatGPT

        return {
          id: item.id,
          user_id: item.user_id,
          title: item.title,
          prompt_text: item.prompt_text,
          image_path: item.image_path,
          default_image_path: item.default_image_path,
          image_url: null, // Set to null since this field doesn't exist in the database
          prompt_type: item.prompt_type as 'text' | 'image' | 'workflow' | 'video' | 'sound' | 'button' | 'image-selection',
          created_at: item.created_at || "",
          metadata: {
            category: validCategory,
            style: metadataObj.style ?? undefined,
            tags: Array.isArray(metadataObj.tags)
              ? metadataObj.tags
              : [],
            media_files: Array.isArray(metadataObj.media_files)
              ? metadataObj.media_files
              : [],
            target_model: metadataObj.target_model ?? undefined,
            use_case: metadataObj.use_case ?? undefined,
            workflow_steps: metadataObj.workflow_steps ?? undefined,
            workflow_files: Array.isArray(metadataObj.workflow_files)
              ? metadataObj.workflow_files
              : [],
            buttons: metadataObj.buttons ?? undefined,
            image_options: metadataObj.image_options ?? undefined,
            button_text: metadataObj.button_text ?? undefined,
            button_action: metadataObj.button_action ?? undefined,
          },
        };
      });
      return transformedData;
    } catch (error: any) {
      console.error("Error fetching prompts:", error);
      setError("Failed to load prompts");
      toast({
        title: "Error",
        description: "Failed to load prompts. Please try again later.",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Update categories list when active categories change
  useEffect(() => {
    if (!categoriesLoading && activeCategories.length > 0) {
      const categoryNames = ["all", ...activeCategories.map(cat => cat.name)];
      setCategories(categoryNames);
    }
  }, [activeCategories, categoriesLoading]);

  // Update all existing prompts to use ChatGPT as their category
  const updateExistingPrompts = async () => {
    if (!session) return;
    
    try {
      // This function will update all prompts without valid categories to use ChatGPT
      const { data, error } = await supabase
        .from("prompts")
        .select("id, metadata");
      
      if (error) throw error;
      
      // For each prompt that doesn't have a proper category, update it
      for (const prompt of (data || [])) {
        // Ensure metadata is always an object
        const metadata = typeof prompt.metadata === 'object' && prompt.metadata !== null 
          ? prompt.metadata as Record<string, any>
          : {};
          
        const category = metadata.category || "";
        
        // Check if the prompt category exists in active categories
        const categoryExists = activeCategories.some(cat => cat.name === category);
        
        if (!categoryExists) {
          const updatedMetadata = {
            ...metadata,
            category: "ChatGPT" // Set to default category
          };
          
          await supabase
            .from("prompts")
            .update({ metadata: updatedMetadata })
            .eq("id", prompt.id);
        }
      }
    } catch (error) {
      console.error("Error updating prompt categories:", error);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (!authLoading && !categoriesLoading) {
      if (session) {
        // First update existing prompts
        updateExistingPrompts().then(() => {
          // Then fetch prompts to show the updated data
          fetchPrompts().then((data) => {
            if (mounted && data) {
              setPrompts(data);
            }
          });
        });
      } else {
        fetchPrompts().then((data) => {
          if (mounted && data) {
            setPrompts(data);
          }
        });
      }
    }
    return () => {
      mounted = false;
    };
  }, [authLoading, session, categoriesLoading, activeCategories]);

  const reloadPrompts = async () => {
    console.log("Reloading prompts...");
    const data = await fetchPrompts();
    if (data) {
      setPrompts(data);
    }
  };

  return { prompts, setPrompts, categories, isLoading, error, reloadPrompts };
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { type Prompt } from "@/types";

export function usePromptsData({ authLoading, session }: { authLoading: boolean; session: any }) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<string[]>(["all"]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        // Ensure all prompts have a valid category from main categories
        const metadata = item.metadata || {};
        const category = metadata.category || "";
        const validCategory = ["ChatGPT", "Midjourney", "n8n"].includes(category) 
          ? category 
          : "ChatGPT"; // Default to ChatGPT

        return {
          id: item.id,
          user_id: item.user_id,
          title: item.title,
          prompt_text: item.prompt_text,
          image_path: item.image_path,
          default_image_path: item.default_image_path,
          prompt_type: item.prompt_type as 'text' | 'image',
          created_at: item.created_at || "",
          metadata: {
            category: validCategory,
            style: (item.metadata as any)?.style ?? undefined,
            tags: Array.isArray((item.metadata as any)?.tags)
              ? (item.metadata as any).tags
              : [],
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
        const metadata = prompt.metadata || {};
        const category = metadata.category || "";
        
        // Check if the prompt needs updating
        if (!["ChatGPT", "Midjourney", "n8n"].includes(category)) {
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
    if (!authLoading) {
      if (session) {
        // First update existing prompts
        updateExistingPrompts().then(() => {
          // Then fetch prompts to show the updated data
          fetchPrompts().then((data) => {
            if (mounted && data) {
              setPrompts(data);
              // Keep only the main categories
              setCategories(["all", "ChatGPT", "Midjourney", "n8n"]);
            }
          });
        });
      } else {
        fetchPrompts().then((data) => {
          if (mounted && data) {
            setPrompts(data);
            // Keep only the main categories
            setCategories(["all", "ChatGPT", "Midjourney", "n8n"]);
          }
        });
      }
    }
    return () => {
      mounted = false;
    };
  }, [authLoading, session]);

  const reloadPrompts = async () => {
    console.log("Reloading prompts...");
    const data = await fetchPrompts();
    if (data) {
      setPrompts(data);
      // Keep only the main categories
      setCategories(["all", "ChatGPT", "Midjourney", "n8n"]);
    }
  };

  return { prompts, setPrompts, categories, isLoading, error, reloadPrompts };
}

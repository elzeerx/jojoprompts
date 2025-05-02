
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
      const transformedData = (data ?? []).map((item) => ({
        id: item.id,
        user_id: item.user_id,
        title: item.title,
        prompt_text: item.prompt_text,
        image_path: item.image_path,
        prompt_type: item.prompt_type as 'text' | 'image',
        created_at: item.created_at || "",
        metadata: {
          category: (item.metadata as any)?.category ?? undefined,
          style: (item.metadata as any)?.style ?? undefined,
          tags: Array.isArray((item.metadata as any)?.tags)
            ? (item.metadata as any).tags
            : [],
        },
      }));
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

  useEffect(() => {
    let mounted = true;
    if (!authLoading) {
      fetchPrompts().then((data) => {
        if (mounted && data) {
          setPrompts(data);
          const uniqueCategories = [
            ...new Set(
              data
                .map((p) => p.metadata?.category)
                .filter(Boolean) as string[]
            ),
          ];
          setCategories(["all", ...uniqueCategories]);
        }
      });
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
      const uniqueCategories = [
        ...new Set(
          data
            .map((p) => p.metadata?.category)
            .filter(Boolean) as string[]
        ),
      ];
      setCategories(["all", ...uniqueCategories]);
    }
  };

  return { prompts, setPrompts, categories, isLoading, error, reloadPrompts };
}

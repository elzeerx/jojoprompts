import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Platform } from '@/types/platform';
import { PromptFormData } from '@/types/prompt-form';

export interface LoadedPromptData {
  prompt: any; // Raw prompt from database
  platform: Platform | null;
  platformFields: any[];
  category: any | null;
}

export interface UsePromptLoaderResult {
  data: LoadedPromptData | null;
  formData: PromptFormData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePromptLoader(promptId?: string): UsePromptLoaderResult {
  const [data, setData] = useState<LoadedPromptData | null>(null);
  const [formData, setFormData] = useState<PromptFormData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPromptData = useCallback(async () => {
    if (!promptId) {
      setData(null);
      setFormData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch prompt with platform info
      const { data: prompt, error: promptError } = await supabase
        .from('prompts')
        .select(`
          *,
          platform:platforms(*)
        `)
        .eq('id', promptId)
        .single();

      if (promptError) throw promptError;
      if (!prompt) throw new Error('Prompt not found');

      // Fetch platform fields
      const { data: platformFields, error: fieldsError } = await supabase
        .from('platform_fields')
        .select('*')
        .eq('platform_id', prompt.platform_id)
        .order('display_order', { ascending: true });

      if (fieldsError) throw fieldsError;

      // Fetch category if exists (from metadata)
      let category = null;
      const categoryId = (prompt.metadata as any)?.category_id;
      if (categoryId) {
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select('*')
          .eq('id', categoryId)
          .single();

        if (!categoryError && categoryData) {
          category = categoryData;
        }
      }

      const loadedData: LoadedPromptData = {
        prompt,
        platform: prompt.platform as Platform | null,
        platformFields: platformFields || [],
        category
      };

      setData(loadedData);

      // Transform to form data
      const transformedFormData: PromptFormData = {
        title: prompt.title || '',
        title_ar: prompt.title_ar || '',
        prompt_text: prompt.prompt_text || '',
        prompt_text_ar: prompt.prompt_text_ar || '',
        category_id: categoryId || '',
        thumbnail: null,
        thumbnail_url: prompt.image_path || '',
        platform_id: prompt.platform_id,
        platform_fields: (prompt.platform_fields as any) || {}
      };

      setFormData(transformedFormData);

    } catch (err) {
      console.error('Error loading prompt:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [promptId]);

  useEffect(() => {
    fetchPromptData();
  }, [fetchPromptData]);

  return {
    data,
    formData,
    loading,
    error,
    refetch: fetchPromptData
  };
}

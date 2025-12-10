import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/utils/logging';

const logger = createLogger('PROMPT_LIST');

export interface PromptListItem {
  id: string;
  title: string;
  prompt_text: string;
  image_path: string | null;
  platform_id: string;
  created_at: string;
  platform?: {
    name: string;
    slug: string;
    icon: string;
  };
}

export function usePromptList(limit: number = 10) {
  const [prompts, setPrompts] = useState<PromptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPrompts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('prompts')
        .select(`
          id,
          title,
          prompt_text,
          image_path,
          platform_id,
          created_at,
          platform:platforms(name, slug, icon)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;
      setPrompts(data || []);
    } catch (err) {
      logger.error('Failed to fetch prompts', { error: err });
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  return {
    prompts,
    loading,
    error,
    refetch: fetchPrompts
  };
}

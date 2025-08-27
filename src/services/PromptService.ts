import { supabase } from '@/integrations/supabase/client';
import type { PromptQuery, PromptQueryResult, PromptRow, PromptMetadata, PromptType } from '@/types/prompts';

export class PromptService {
  static async getPrompts(query: PromptQuery = {}): Promise<PromptQueryResult> {
    try {
      let supabaseQuery = supabase
        .from('prompts')
        .select(`
          id,
          title,
          prompt_text,
          prompt_type,
          user_id,
          image_path,
          default_image_path,
          metadata,
          created_at,
          profiles!prompts_user_id_fkey(username)
        `)
        .order(query.orderBy || 'created_at', { 
          ascending: query.orderDirection === 'asc' 
        });

      // Apply filters
      if (query.category && query.category !== 'all') {
        supabaseQuery = supabaseQuery.contains('metadata', { category: query.category });
      }

      if (query.type && query.type !== 'all') {
        supabaseQuery = supabaseQuery.eq('prompt_type', query.type);
      }

      if (query.search && query.search.trim()) {
        const searchTerm = `%${query.search.trim()}%`;
        supabaseQuery = supabaseQuery.or(
          `title.ilike.${searchTerm},prompt_text.ilike.${searchTerm},metadata->category.ilike.${searchTerm}`
        );
      }

      // Apply pagination
      if (query.limit) {
        supabaseQuery = supabaseQuery.limit(query.limit);
      }
      
      if (query.offset) {
        supabaseQuery = supabaseQuery.range(query.offset, query.offset + (query.limit || 50) - 1);
      }

      const { data, error, count } = await supabaseQuery;

      if (error) {
        console.error('Error fetching prompts:', error);
        return {
          data: [],
          count: 0,
          error: error.message
        };
      }

      // Transform data to include uploader info
      const transformedData = (data || []).map((prompt: any) => ({
        ...prompt,
        uploader_name: prompt.profiles?.username || 'Anonymous',
        uploader_username: prompt.profiles?.username
      })) as PromptRow[];

      return {
        data: transformedData,
        count: count || transformedData.length
      };
    } catch (error) {
      console.error('Service error fetching prompts:', error);
      return {
        data: [],
        count: 0,
        error: error instanceof Error ? error.message : 'Failed to fetch prompts'
      };
    }
  }

  static async getPromptById(id: string): Promise<PromptRow | null> {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select(`
          id,
          title,
          prompt_text,
          prompt_type,
          user_id,
          image_path,
          default_image_path,
          metadata,
          created_at,
          profiles!prompts_user_id_fkey(username, first_name, last_name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching prompt:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      return {
        id: data.id,
        title: data.title,
        prompt_text: data.prompt_text,
        prompt_type: data.prompt_type as PromptType,
        user_id: data.user_id,
        image_path: data.image_path,
        default_image_path: data.default_image_path,
        metadata: (data.metadata as any) || {},
        created_at: data.created_at,
        uploader_name: (data.profiles as any)?.username || 'Anonymous',
        uploader_username: (data.profiles as any)?.username
      };
    } catch (error) {
      console.error('Service error fetching prompt:', error);
      return null;
    }
  }

  static async searchPrompts(searchTerm: string, limit = 20): Promise<PromptRow[]> {
    const result = await this.getPrompts({
      search: searchTerm,
      limit,
      orderBy: 'created_at',
      orderDirection: 'desc'
    });

    return result.data;
  }

  static async getPromptsByCategory(category: string, limit = 50): Promise<PromptRow[]> {
    const result = await this.getPrompts({
      category,
      limit,
      orderBy: 'created_at',
      orderDirection: 'desc'
    });

    return result.data;
  }
}
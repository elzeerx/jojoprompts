import { supabase } from '@/integrations/supabase/client';
import type { PromptQuery, PromptQueryResult, PromptRow, PromptMetadata, PromptType } from '@/types/prompts';

// Enhanced prompt service interfaces for CRUD operations
export interface CreatePromptData {
  title: string;
  description?: string;
  content: string;
  categoryId?: string;
  tags?: string[];
  isPublic?: boolean;
  imageUrl?: string;
  userId: string;
  prompt_type?: PromptType;
}

export interface UpdatePromptData {
  title?: string;
  description?: string;
  content?: string;
  categoryId?: string;
  tags?: string[];
  isPublic?: boolean;
  imageUrl?: string;
}

export interface PromptSearchOptions {
  searchTerm?: string;
  categoryId?: string;
  tags?: string[];
  isPublic?: boolean;
  userId?: string;
  sortBy?: 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

interface ApiResponse<T = any> { 
  data?: T; 
  error?: any; 
  success: boolean; 
}

export class PromptService {
  // Enhanced getPrompts with safe profile fetching
  static async getPrompts(query: PromptQuery = {}): Promise<PromptQueryResult> {
    try {
      // Basic prompt query without joins to avoid RLS issues
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
          created_at
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
          `title.ilike.${searchTerm},prompt_text.ilike.${searchTerm},metadata->>category.ilike.${searchTerm}`
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

      // Batch fetch uploader names for better performance
      const uniqueUserIds = [...new Set((data || []).map((prompt: any) => prompt.user_id))];
      
      // Single batch query for all profiles
      let profileMap: Record<string, string> = {};
      if (uniqueUserIds.length > 0) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', uniqueUserIds);
          
          profileMap = (profiles || []).reduce((acc, profile) => {
            acc[profile.id] = profile.username || 'Anonymous';
            return acc;
          }, {} as Record<string, string>);
        } catch (profileError) {
          console.debug('Batch profile fetch failed:', profileError);
        }
      }

      // Transform data with cached profile info
      const transformedData = (data || []).map((prompt: any) => {
        const uploader_name = profileMap[prompt.user_id] || 'Anonymous';
        return {
          ...prompt,
          uploader_name,
          uploader_username: uploader_name !== 'Anonymous' ? uploader_name : undefined
        };
      }) as PromptRow[];

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
          created_at
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

      // Safely fetch uploader info
      let uploader_name = 'Anonymous';
      let uploader_username = undefined;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, first_name, last_name')
          .eq('id', data.user_id)
          .maybeSingle();
        
        if (profile) {
          uploader_name = profile.username || 'Anonymous';
          uploader_username = profile.username;
        }
      } catch (profileError) {
        console.debug('Profile fetch failed (expected for non-admin users):', profileError);
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
        uploader_name,
        uploader_username
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

  // CRUD operations from the old service
  static async createPrompt(data: CreatePromptData): Promise<ApiResponse<any>> {
    try {
      const promptData = {
        title: data.title,
        prompt_text: data.content,
        prompt_type: data.prompt_type || 'image',
        user_id: data.userId,
        metadata: {
          description: data.description,
          tags: data.tags,
          isPublic: data.isPublic
        },
        image_path: data.imageUrl
      };

      const { data: result, error } = await supabase
        .from('prompts')
        .insert(promptData)
        .select('*')
        .single();

      if (error) throw error;

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  static async updatePrompt(promptId: string, data: UpdatePromptData): Promise<ApiResponse<any>> {
    try {
      const updateData = {
        title: data.title,
        prompt_text: data.content,
        image_path: data.imageUrl,
        metadata: {
          description: data.description,
          tags: data.tags,
          isPublic: data.isPublic
        }
      };

      const { data: result, error } = await supabase
        .from('prompts')
        .update(updateData)
        .eq('id', promptId)
        .select('*')
        .single();

      if (error) throw error;

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  static async deletePrompt(promptId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('prompts')
        .delete()
        .eq('id', promptId);

      if (error) throw error;

      return { success: true, data: undefined };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  // Public prompts with type filtering
  static async getPublicPrompts(limit = 20, offset = 0, promptType?: PromptType): Promise<ApiResponse<PromptRow[]>> {
    try {
      const result = await this.getPrompts({
        type: promptType || 'all',
        limit,
        offset,
        orderBy: 'created_at',
        orderDirection: 'desc'
      });

      return { success: true, data: result.data };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  static async getUserPrompts(userId: string): Promise<ApiResponse<PromptRow[]>> {
    try {
      let supabaseQuery = supabase
        .from('prompts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const { data, error } = await supabaseQuery;

      if (error) throw error;

      const transformedData = (data || []).map(prompt => ({
        ...prompt,
        uploader_name: 'You',
        uploader_username: undefined
      })) as PromptRow[];

      return { success: true, data: transformedData };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  // Usage tracking
  static async recordPromptUsage(promptId: string, userId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('prompt_usage_history')
        .insert({
          action_type: 'used',
          prompt_id: promptId,
          user_id: userId,
          metadata: {}
        });

      if (error) throw error;

      return { success: true, data: undefined };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  // Category management  
  static async getCategories(): Promise<ApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  // Favorites management
  static async addToFavorites(userId: string, promptId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('favorites')
        .insert({
          user_id: userId,
          prompt_id: promptId
        });

      if (error) throw error;

      return { success: true, data: undefined };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  static async removeFromFavorites(userId: string, promptId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('prompt_id', promptId);

      if (error) throw error;

      return { success: true, data: undefined };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  static async getUserFavorites(userId: string): Promise<ApiResponse<PromptRow[]>> {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          prompt_id,
          prompts (*)
        `)
        .eq('user_id', userId);

      if (error) throw error;

      const transformedData = (data || []).map((favorite: any) => ({
        ...favorite.prompts,
        uploader_name: 'Anonymous',
        uploader_username: undefined
      })) as PromptRow[];

      return { success: true, data: transformedData };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  // Analytics and statistics - simplified to avoid RLS issues
  static async getPromptStats(): Promise<ApiResponse<any>> {
    try {
      const { data: prompts } = await supabase
        .from('prompts')
        .select('prompt_type, created_at, metadata');

      const totalPrompts = prompts?.length || 0;
      const imagePrompts = prompts?.filter(p => p.prompt_type === 'image').length || 0;
      const textPrompts = prompts?.filter(p => p.prompt_type === 'text').length || 0;
      const workflowPrompts = prompts?.filter(p => p.prompt_type === 'workflow').length || 0;
      
      const recentPrompts = prompts?.filter(p => 
        new Date(p.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length || 0;

      return {
        success: true,
        data: {
          totalPrompts,
          imagePrompts,
          textPrompts,
          workflowPrompts,
          recentPrompts
        }
      };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  /**
   * Translate a prompt using AI
   */
  static async translatePrompt(
    promptId: string, 
    targetLanguage: 'arabic' | 'english', 
    overwrite: boolean = false
  ): Promise<ApiResponse<any>> {
    try {
      const { data, error } = await supabase.functions.invoke('translate-prompt', {
        body: {
          prompt_id: promptId,
          target_language: targetLanguage,
          overwrite
        }
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error translating prompt:', error);
      // Extract the actual error message from the edge function response
      const errorMessage = error instanceof Error ? error.message : 'Failed to translate prompt';
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }
}
/**
 * Prompt service for handling prompt-related operations
 * Simplified to avoid TypeScript type recursion issues
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
interface ApiResponse<T = any> { data?: T; error?: any; success: boolean; }

// Prompt-related type interfaces
export interface CreatePromptData {
  title: string;
  description?: string;
  content: string;
  categoryId?: string;
  tags?: string[];
  isPublic?: boolean;
  imageUrl?: string;
  userId: string;
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

export class PromptService {
  constructor() {}

  // Prompt CRUD operations
  async createPrompt(data: CreatePromptData): Promise<ApiResponse<any>> {
    try {
      const promptData = {
        title: data.title,
        prompt_text: data.content,
        prompt_type: 'image',
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

  async updatePrompt(promptId: string, data: UpdatePromptData): Promise<ApiResponse<any>> {
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

  async deletePrompt(promptId: string): Promise<ApiResponse<void>> {
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

  async getPrompt(promptId: string): Promise<ApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('id', promptId)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  // Search and filtering
  async searchPrompts(options: PromptSearchOptions): Promise<ApiResponse<any[]>> {
    try {
      let query = supabase.from('prompts').select('*');

      // Apply filters
      if (options.searchTerm) {
        query = query.or(`title.ilike.%${options.searchTerm}%,prompt_text.ilike.%${options.searchTerm}%`);
      }

      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }

      // Apply sorting
      const sortBy = options.sortBy || 'created_at';
      const ascending = options.sortOrder === 'asc';
      query = query.order(sortBy, { ascending });

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  async getPublicPrompts(limit = 20, offset = 0): Promise<ApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  async getUserPrompts(userId: string): Promise<ApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  async getPopularPrompts(limit = 20): Promise<ApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  async getRecentPrompts(limit = 10): Promise<ApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  // Usage tracking
  async recordPromptUsage(promptId: string, userId: string): Promise<ApiResponse<void>> {
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
  async getCategories(): Promise<ApiResponse<any[]>> {
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
  async addToFavorites(userId: string, promptId: string): Promise<ApiResponse<void>> {
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

  async removeFromFavorites(userId: string, promptId: string): Promise<ApiResponse<void>> {
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

  async getUserFavorites(userId: string): Promise<ApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          prompt_id,
          prompts (*)
        `)
        .eq('user_id', userId);

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }

  // Analytics and statistics
  async getPromptStats(): Promise<ApiResponse<any>> {
    try {
      const { data: prompts } = await supabase
        .from('prompts')
        .select('prompt_type, created_at, metadata');

      const totalPrompts = prompts?.length || 0;
      const imagePrompts = prompts?.filter(p => p.prompt_type === 'image').length || 0;
      const textPrompts = prompts?.filter(p => p.prompt_type === 'text').length || 0;
      
      const recentPrompts = prompts?.filter(p => 
        new Date(p.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length || 0;

      return {
        success: true,
        data: {
          totalPrompts,
          imagePrompts,
          textPrompts,
          recentPrompts
        }
      };
    } catch (error: any) {
      return { success: false, error: { message: error.message } };
    }
  }
}

// Export singleton instance
export const promptService = new PromptService();
/**
 * Prompt service for managing prompts, categories, and content
 */

import { BaseService } from './BaseService';
import { supabase } from '@/integrations/supabase/client';
import { Prompt, Category, PromptType, ApiResponse } from '@/types/common';
import { logger } from '@/utils/logger';

export interface CreatePromptData {
  title: string;
  prompt_text: string;
  prompt_type: PromptType;
  user_id: string;
  image_path?: string;
  default_image_path?: string;
  metadata?: Record<string, any>;
}

export interface UpdatePromptData {
  title?: string;
  prompt_text?: string;
  image_path?: string;
  default_image_path?: string;
  metadata?: Record<string, any>;
}

export interface PromptSearchOptions {
  searchTerm?: string;
  category?: string;
  promptType?: PromptType;
  tags?: string[];
  userId?: string;
  sortBy?: 'created_at' | 'title' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

class PromptService extends BaseService<Prompt> {
  constructor() {
    super('prompts', 'PromptService');
  }

  // Prompt CRUD operations
  async createPrompt(data: CreatePromptData): Promise<ApiResponse<Prompt>> {
    return this.create(data);
  }

  async updatePrompt(promptId: string, data: UpdatePromptData): Promise<ApiResponse<Prompt>> {
    return this.update(promptId, data);
  }

  async deletePrompt(promptId: string, userId: string): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'deletePrompt',
      async () => {
        // Verify ownership or admin privileges
        const { data: prompt } = await supabase
          .from('prompts')
          .select('user_id')
          .eq('id', promptId)
          .single();

        if (!prompt) {
          throw new Error('Prompt not found');
        }

        const { data: userProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();

        const isOwner = prompt.user_id === userId;
        const isAdmin = userProfile?.role === 'admin';
        const canManage = userProfile?.role === 'prompter' || userProfile?.role === 'jadmin';

        if (!isOwner && !isAdmin && !canManage) {
          throw new Error('Insufficient permissions to delete this prompt');
        }

        return supabase.from('prompts').delete().eq('id', promptId);
      },
      { promptId, userId }
    );
  }

  // Search and filtering
  async searchPrompts(
    options: PromptSearchOptions,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApiResponse<any>> {
    return this.executeQuery(
      'searchPrompts',
      async () => {
        let query = supabase.from('prompts').select('*') as any;

        // Text search
        if (options.searchTerm) {
          query = query.or(`title.ilike.%${options.searchTerm}%,prompt_text.ilike.%${options.searchTerm}%`);
        }

        // Filter by prompt type
        if (options.promptType) {
          query = query.eq('prompt_type', options.promptType);
        }

        // Filter by category (if stored in metadata)
        if (options.category) {
          query = query.contains('metadata', { category: options.category });
        }

        // Filter by tags (if stored in metadata)
        if (options.tags && options.tags.length > 0) {
          options.tags.forEach(tag => {
            query = query.contains('metadata', { tags: [tag] });
          });
        }

        // Filter by user
        if (options.userId) {
          query = query.eq('user_id', options.userId);
        }

        // Sorting
        const sortBy = options.sortBy || 'created_at';
        const ascending = options.sortOrder === 'asc';
        query = query.order(sortBy, { ascending });

        // Pagination
        const offset = (page - 1) * pageSize;
        query = query.range(offset, offset + pageSize - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        return {
          data: {
            prompts: data,
            totalCount: count,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize)
          }
        };
      },
      { options, page, pageSize }
    );
  }

  async getPromptsByType(promptType: PromptType, limit: number = 20): Promise<ApiResponse<Prompt[]>> {
    return this.findAll({
      filters: { prompt_type: promptType },
      orderBy: { column: 'created_at', ascending: false },
      limit
    });
  }

  async getPromptsByUser(userId: string, limit: number = 20): Promise<ApiResponse<Prompt[]>> {
    return this.findAll({
      filters: { user_id: userId },
      orderBy: { column: 'created_at', ascending: false },
      limit
    });
  }

  async getFeaturedPrompts(limit: number = 10): Promise<ApiResponse<Prompt[]>> {
    return this.executeQuery(
      'getFeaturedPrompts',
      () => supabase
        .from('prompts')
        .select('*')
        .contains('metadata', { featured: true })
        .order('created_at', { ascending: false })
        .limit(limit),
      { limit }
    );
  }

  // Category management
  async getCategories(): Promise<ApiResponse<Category[]>> {
    return this.executeQuery(
      'getCategories',
      () => {
        const categoryService = new BaseService<Category>('categories');
        return categoryService.findAll({
          filters: { is_active: true },
          orderBy: { column: 'display_order', ascending: true }
        });
      }
    );
  }

  async createCategory(data: Partial<Category>): Promise<ApiResponse<Category>> {
    return this.executeQuery(
      'createCategory',
      () => {
        const categoryService = new BaseService<Category>('categories');
        return categoryService.create(data);
      },
      { data }
    );
  }

  async updateCategory(categoryId: string, data: Partial<Category>): Promise<ApiResponse<Category>> {
    return this.executeQuery(
      'updateCategory',
      () => {
        const categoryService = new BaseService<Category>('categories');
        return categoryService.update(categoryId, data);
      },
      { categoryId, data }
    );
  }

  // Favorites management
  async addToFavorites(userId: string, promptId: string): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'addToFavorites',
      () => supabase
        .from('favorites')
        .insert({ user_id: userId, prompt_id: promptId }),
      { userId, promptId }
    );
  }

  async removeFromFavorites(userId: string, promptId: string): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'removeFromFavorites',
      () => supabase
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('prompt_id', promptId),
      { userId, promptId }
    );
  }

  async getUserFavorites(userId: string, limit: number = 20): Promise<ApiResponse<Prompt[]>> {
    return this.executeQuery(
      'getUserFavorites',
      () => supabase
        .from('favorites')
        .select(`
          prompts (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      { userId, limit }
    );
  }

  async checkIsFavorite(userId: string, promptId: string): Promise<ApiResponse<boolean>> {
    return this.executeQuery(
      'checkIsFavorite',
      async () => {
        const { data, error } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', userId)
          .eq('prompt_id', promptId)
          .single();

        if (error && error.code === 'PGRST116') {
          // No rows returned - not a favorite
          return { data: false };
        }

        if (error) throw error;
        return { data: !!data };
      },
      { userId, promptId }
    );
  }

  // Usage tracking
  async recordPromptUsage(userId: string, promptId: string, actionType: string, metadata?: Record<string, any>): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'recordPromptUsage',
      () => supabase
        .from('prompt_usage_history')
        .insert({
          user_id: userId,
          prompt_id: promptId,
          action_type: actionType,
          metadata: metadata || {}
        }),
      { userId, promptId, actionType }
    );
  }

  async getPromptUsageStats(promptId: string): Promise<ApiResponse<Record<string, any>>> {
    return this.executeQuery(
      'getPromptUsageStats',
      async () => {
        const { data: usage, error } = await supabase
          .from('prompt_usage_history')
          .select('action_type, created_at')
          .eq('prompt_id', promptId);

        if (error) throw error;

        const stats = {
          totalUsage: usage?.length || 0,
          viewCount: usage?.filter(u => u.action_type === 'view').length || 0,
          copyCount: usage?.filter(u => u.action_type === 'copy').length || 0,
          downloadCount: usage?.filter(u => u.action_type === 'download').length || 0,
          shareCount: usage?.filter(u => u.action_type === 'share').length || 0,
          lastUsed: usage?.[0]?.created_at || null
        };

        return { data: stats };
      },
      { promptId }
    );
  }

  // Admin and analytics
  async getPromptStats(): Promise<ApiResponse<Record<string, any>>> {
    return this.executeQuery(
      'getPromptStats',
      async () => {
        const [
          { count: totalPrompts },
          { count: imagePrompts },
          { count: textPrompts },
          { count: workflowPrompts }
        ] = await Promise.all([
          supabase.from('prompts').select('*', { count: 'exact', head: true }),
          supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('prompt_type', 'image'),
          supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('prompt_type', 'text'),
          supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('prompt_type', 'workflow')
        ]);

        return {
          data: {
            total: totalPrompts || 0,
            byType: {
              image: imagePrompts || 0,
              text: textPrompts || 0,
              workflow: workflowPrompts || 0
            }
          }
        };
      }
    );
  }

  async getTopPrompts(limit: number = 10): Promise<ApiResponse<any[]>> {
    return this.executeQuery(
      'getTopPrompts',
      async () => {
        // Get prompts with usage counts
        const { data: prompts, error } = await supabase
          .from('prompts')
          .select(`
            *,
            prompt_usage_history(count)
          `)
          .order('created_at', { ascending: false })
          .limit(limit * 2); // Get more to sort by usage

        if (error) throw error;

        // Sort by usage count and take top results
        const sortedPrompts = prompts
          ?.map(prompt => ({
            ...prompt,
            usageCount: prompt.prompt_usage_history?.length || 0
          }))
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, limit);

        return { data: sortedPrompts || [] };
      },
      { limit }
    );
  }
}

export const promptService = new PromptService();
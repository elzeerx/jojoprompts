/**
 * Prompt service for handling prompt-related operations
 * Extends BaseService with prompt-specific functionality
 */

import { BaseService } from './BaseService';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { ApiResponse } from '@/types/common';

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
  sortBy?: 'created_at' | 'updated_at' | 'usage_count';
  sortOrder?: 'asc' | 'desc';
}

export interface Prompt {
  id: string;
  title: string;
  description?: string;
  content: string;
  category_id?: string;
  tags?: string[];
  is_public: boolean;
  image_url?: string;
  user_id: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export class PromptService extends BaseService<Prompt> {
  constructor() {
    super('prompts', 'PromptService');
  }

  // Prompt CRUD operations
  async createPrompt(data: CreatePromptData): Promise<ApiResponse<Prompt>> {
    const promptData = {
      title: data.title,
      description: data.description,
      content: data.content,
      category_id: data.categoryId,
      tags: data.tags,
      is_public: data.isPublic ?? false,
      image_url: data.imageUrl,
      user_id: data.userId,
      usage_count: 0
    };

    return this.create(promptData);
  }

  async updatePrompt(promptId: string, data: UpdatePromptData): Promise<ApiResponse<Prompt>> {
    const updateData = {
      ...data,
      category_id: data.categoryId,
      is_public: data.isPublic,
      image_url: data.imageUrl,
      updated_at: new Date().toISOString()
    };

    return this.update(promptId, updateData);
  }

  async deletePrompt(promptId: string): Promise<ApiResponse<void>> {
    return this.delete(promptId);
  }

  async getPrompt(promptId: string): Promise<ApiResponse<Prompt>> {
    return this.findById(promptId);
  }

  // Search and filtering
  async searchPrompts(options: PromptSearchOptions): Promise<ApiResponse<Prompt[]>> {
    return this.executeQuery(
      'searchPrompts',
      () => {
        let query = supabase.from('prompts').select('*');

        // Apply filters
        if (options.searchTerm) {
          query = query.or(`title.ilike.%${options.searchTerm}%,description.ilike.%${options.searchTerm}%,content.ilike.%${options.searchTerm}%`);
        }

        if (options.categoryId) {
          query = query.eq('category_id', options.categoryId);
        }

        if (options.isPublic !== undefined) {
          query = query.eq('is_public', options.isPublic);
        }

        if (options.userId) {
          query = query.eq('user_id', options.userId);
        }

        if (options.tags && options.tags.length > 0) {
          query = query.overlaps('tags', options.tags);
        }

        // Apply sorting
        const sortBy = options.sortBy || 'created_at';
        const ascending = options.sortOrder === 'asc';
        query = query.order(sortBy, { ascending });

        return query;
      },
      options
    );
  }

  async getPublicPrompts(limit = 20, offset = 0): Promise<ApiResponse<Prompt[]>> {
    return this.findAll({
      filters: { is_public: true },
      orderBy: { column: 'created_at', ascending: false },
      limit,
      offset
    });
  }

  async getUserPrompts(userId: string, includePrivate = false): Promise<ApiResponse<Prompt[]>> {
    const filters: any = { user_id: userId };
    
    if (!includePrivate) {
      filters.is_public = true;
    }

    return this.findAll({
      filters,
      orderBy: { column: 'created_at', ascending: false }
    });
  }

  async getPopularPrompts(limit = 20): Promise<ApiResponse<Prompt[]>> {
    return this.findAll({
      filters: { is_public: true },
      orderBy: { column: 'usage_count', ascending: false },
      limit
    });
  }

  async getRecentPrompts(limit = 10): Promise<ApiResponse<Prompt[]>> {
    return this.findAll({
      filters: { is_public: true },
      orderBy: { column: 'created_at', ascending: false },
      limit
    });
  }

  async getPromptsByCategory(categoryId: string, limit = 20): Promise<ApiResponse<Prompt[]>> {
    return this.findAll({
      filters: { category_id: categoryId, is_public: true },
      orderBy: { column: 'created_at', ascending: false },
      limit
    });
  }

  // Usage tracking
  async incrementUsageCount(promptId: string): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'incrementUsageCount',
      () => supabase.rpc('increment_prompt_usage', { prompt_id: promptId }),
      { promptId }
    );
  }

  async recordPromptUsage(promptId: string, userId: string): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'recordPromptUsage',
      () => supabase
        .from('prompt_usage_history')
        .insert({
          prompt_id: promptId,
          user_id: userId,
          used_at: new Date().toISOString()
        }),
      { promptId, userId }
    );
  }

  // Category management
  async getCategories(): Promise<ApiResponse<Category[]>> {
    return this.executeQuery(
      'getCategories',
      () => supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
    );
  }

  async createCategory(data: Partial<Category>): Promise<ApiResponse<Category>> {
    return this.executeQuery(
      'createCategory',
      () => supabase
        .from('categories')
        .insert(data)
        .select('*')
        .single(),
      { data }
    );
  }

  async updateCategory(categoryId: string, data: Partial<Category>): Promise<ApiResponse<Category>> {
    return this.executeQuery(
      'updateCategory',
      () => supabase
        .from('categories')
        .update(data)
        .eq('id', categoryId)
        .select('*')
        .single(),
      { categoryId, data }
    );
  }

  // Favorites management
  async addToFavorites(userId: string, promptId: string): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'addToFavorites',
      () => supabase
        .from('favorites')
        .insert({
          user_id: userId,
          prompt_id: promptId
        }),
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

  async getUserFavorites(userId: string): Promise<ApiResponse<Prompt[]>> {
    return this.executeQuery(
      'getUserFavorites',
      () => supabase
        .from('favorites')
        .select(`
          prompts (
            id, title, description, content, category_id, tags, is_public, 
            image_url, user_id, usage_count, created_at, updated_at
          )
        `)
        .eq('user_id', userId),
      { userId }
    );
  }

  // Analytics and statistics
  async getPromptStats(): Promise<ApiResponse<any>> {
    return this.executeQuery(
      'getPromptStats',
      async () => {
        const { data: prompts } = await supabase
          .from('prompts')
          .select('is_public, created_at, usage_count');

        const totalPrompts = prompts?.length || 0;
        const publicPrompts = prompts?.filter(p => p.is_public).length || 0;
        const privatePrompts = totalPrompts - publicPrompts;
        const totalUsage = prompts?.reduce((sum, p) => sum + (p.usage_count || 0), 0) || 0;
        
        const recentPrompts = prompts?.filter(p => 
          new Date(p.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length || 0;

        return {
          data: {
            totalPrompts,
            publicPrompts,
            privatePrompts,
            totalUsage,
            recentPrompts,
            averageUsage: totalPrompts > 0 ? totalUsage / totalPrompts : 0
          }
        };
      }
    );
  }

  // Bulk operations
  async bulkUpdatePrompts(
    promptIds: string[], 
    updateData: Partial<Prompt>
  ): Promise<ApiResponse<Prompt[]>> {
    return this.executeQuery(
      'bulkUpdatePrompts',
      () => supabase
        .from('prompts')
        .update(updateData)
        .in('id', promptIds)
        .select('*'),
      { promptIds, updateData }
    );
  }

  async bulkDeletePrompts(promptIds: string[]): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'bulkDeletePrompts',
      () => supabase
        .from('prompts')
        .delete()
        .in('id', promptIds),
      { promptIds }
    );
  }
}

// Export singleton instance
export const promptService = new PromptService();
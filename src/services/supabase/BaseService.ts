/**
 * Base service class for Supabase operations
 * Provides common CRUD operations and error handling
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { ApiResponse, PaginatedResponse } from '@/types/common';

export interface QueryOptions {
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
}

export interface InsertOptions {
  returning?: string;
  onConflict?: string;
}

export interface UpdateOptions {
  returning?: string;
}

export abstract class BaseService<T = any> {
  protected tableName: string;
  protected serviceName: string;

  constructor(tableName: string, serviceName?: string) {
    this.tableName = tableName;
    this.serviceName = serviceName || `${tableName}Service`;
  }

  protected buildQuery(options: QueryOptions = {}) {
    let query = supabase.from(this.tableName as any);

    // Select specific columns
    if (options.select) {
      query = query.select(options.select) as any;
    } else {
      query = query.select('*') as any;
    }

    // Apply filters
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            query = (query as any).in(key, value);
          } else if (typeof value === 'string' && value.includes('%')) {
            query = (query as any).like(key, value);
          } else {
            query = (query as any).eq(key, value);
          }
        }
      });
    }

    // Order by
    if (options.orderBy) {
      query = (query as any).order(options.orderBy.column, { 
        ascending: options.orderBy.ascending !== false 
      });
    }

    // Pagination
    if (options.limit) {
      query = (query as any).limit(options.limit);
    }
    
    if (options.offset) {
      query = (query as any).range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    return query;
  }

  protected async executeQuery<R = T>(
    operation: string,
    queryFn: () => any,
    context?: Record<string, any>
  ): Promise<ApiResponse<R>> {
    try {
      logger.api(`Starting ${operation}`, this.serviceName, context || {});
      
      const { data, error, count } = await queryFn();
      
      if (error) {
        logger.error(`${operation} failed`, this.serviceName, { 
          error: error.message, 
          context 
        });
        
        return {
          success: false,
          error: {
            message: error.message,
            code: error.code,
            details: error.details
          }
        };
      }

      logger.api(`${operation} completed successfully`, this.serviceName, { 
        resultCount: Array.isArray(data) ? data.length : (data ? 1 : 0),
        context: context || {}
      });

      return {
        success: true,
        data,
        ...(count !== undefined && { count })
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`${operation} threw exception`, this.serviceName, { 
        error: errorMessage,
        context 
      });

      return {
        success: false,
        error: {
          message: errorMessage,
          details: { context }
        }
      };
    }
  }

  async findAll(options: QueryOptions = {}): Promise<ApiResponse<T[]>> {
    return this.executeQuery(
      'findAll',
      () => this.buildQuery(options),
      { tableName: this.tableName, options }
    );
  }

  async findById(id: string, select?: string): Promise<ApiResponse<T>> {
    return this.executeQuery(
      'findById',
      () => {
        let query = supabase.from(this.tableName as any);
        if (select) {
          query = query.select(select) as any;
        } else {
          query = query.select('*') as any;
        }
        return (query as any).eq('id', id).single();
      },
      { id, select }
    );
  }

  async findOne(filters: Record<string, any>, select?: string): Promise<ApiResponse<T>> {
    return this.executeQuery(
      'findOne',
      () => {
        const options: QueryOptions = { filters, select };
        return (this.buildQuery(options) as any).single();
      },
      { filters, select }
    );
  }

  async findPaginated(
    page: number = 1, 
    pageSize: number = 10, 
    options: QueryOptions = {}
  ): Promise<ApiResponse<PaginatedResponse<T>>> {
    const offset = (page - 1) * pageSize;
    
    return this.executeQuery(
      'findPaginated',
      async () => {
        // Get total count
        const { count: totalCount } = await supabase
          .from(this.tableName as any)
          .select('*', { count: 'exact', head: true });

        // Get paginated data
        const result = await this.buildQuery({
          ...options,
          limit: pageSize,
          offset
        });
        
        const { data, error } = result;

        if (error) throw error;

        const totalPages = Math.ceil((totalCount || 0) / pageSize);

        return {
          data: {
            data,
            count: totalCount || 0,
            page,
            pageSize,
            totalPages
          }
        };
      },
      { page, pageSize, options }
    );
  }

  async create(data: Partial<T>, options: InsertOptions = {}): Promise<ApiResponse<T>> {
    return this.executeQuery(
      'create',
      () => {
        let query = supabase.from(this.tableName as any).insert(data as any);
        
        if (options.returning) {
          query = (query as any).select(options.returning);
        } else {
          query = (query as any).select('*');
        }

        if (options.onConflict) {
          query = (query as any).upsert(data as any, { onConflict: options.onConflict });
        }

        return (query as any).single();
      },
      { data, options }
    );
  }

  async createMany(data: Partial<T>[], options: InsertOptions = {}): Promise<ApiResponse<T[]>> {
    return this.executeQuery(
      'createMany',
      () => {
        let query = supabase.from(this.tableName as any).insert(data as any);
        
        if (options.returning) {
          query = (query as any).select(options.returning);
        } else {
          query = (query as any).select('*');
        }

        return query;
      },
      { count: data.length, options }
    );
  }

  async update(id: string, data: Partial<T>, options: UpdateOptions = {}): Promise<ApiResponse<T>> {
    return this.executeQuery(
      'update',
      () => {
        let query = supabase.from(this.tableName as any)
          .update(data as any)
          .eq('id', id) as any;
        
        if (options.returning) {
          query = query.select(options.returning);
        } else {
          query = query.select('*');
        }

        return query.single();
      },
      { id, data, options }
    );
  }

  async updateMany(
    filters: Record<string, any>, 
    data: Partial<T>, 
    options: UpdateOptions = {}
  ): Promise<ApiResponse<T[]>> {
    return this.executeQuery(
      'updateMany',
      () => {
        let query = supabase.from(this.tableName as any).update(data as any) as any;
        
        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
        
        if (options.returning) {
          query = query.select(options.returning);
        } else {
          query = query.select('*');
        }

        return query;
      },
      { filters, data, options }
    );
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'delete',
      () => supabase.from(this.tableName as any).delete().eq('id', id) as any,
      { id }
    );
  }

  async deleteMany(filters: Record<string, any>): Promise<ApiResponse<void>> {
    return this.executeQuery(
      'deleteMany',
      () => {
        let query = supabase.from(this.tableName as any).delete() as any;
        
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });

        return query;
      },
      { filters }
    );
  }

  async count(filters: Record<string, any> = {}): Promise<ApiResponse<number>> {
    return this.executeQuery(
      'count',
      async () => {
        let query = supabase.from(this.tableName as any).select('*', { count: 'exact', head: true }) as any;
        
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });

        const { count } = await query;
        return { data: count || 0 };
      },
      { filters }
    );
  }

  // RPC (Remote Procedure Call) helper
  async callFunction<R = any>(
    functionName: string, 
    params: Record<string, any> = {}
  ): Promise<ApiResponse<R>> {
    return this.executeQuery(
      `callFunction:${functionName}`,
      () => supabase.rpc(functionName as any, params),
      { functionName, params }
    );
  }

  // Edge function helper
  async callEdgeFunction<R = any>(
    functionName: string, 
    body: Record<string, any> = {}
  ): Promise<ApiResponse<R>> {
    return this.executeQuery(
      `callEdgeFunction:${functionName}`,
      () => supabase.functions.invoke(functionName, { body }),
      { functionName, body }
    );
  }
}
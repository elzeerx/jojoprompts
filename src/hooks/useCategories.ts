import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category, CategoryWriteInput } from "@/types/category";
import { toast } from "@/hooks/use-toast";
import { createLogger } from '@/utils/logging';

const logger = createLogger('CATEGORIES');

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;

      const transformedData = (data || []).map(item => ({
        ...item,
        features: Array.isArray(item.features) ? item.features.filter((f): f is string => typeof f === 'string') : []
      }));

      setCategories(transformedData);
    } catch (error: unknown) {
      logger.error('Failed to fetch categories', { error: errorMessage(error) });
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const createCategory = async (categoryData: CategoryWriteInput) => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .insert([categoryData])
        .select()
        .single();

      if (error) throw error;

      await fetchCategories();
      toast({
        title: "Success",
        description: "Category created successfully",
      });
      return data;
    } catch (error: unknown) {
      logger.error('Failed to create category', { error: errorMessage(error) });
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateCategory = async (id: string, categoryData: Partial<Category>) => {
    try {
      const { error } = await supabase
        .from("categories")
        .update(categoryData)
        .eq("id", id);

      if (error) throw error;

      await fetchCategories();
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
    } catch (error: unknown) {
      logger.error('Failed to update category', { error: errorMessage(error), categoryId: id });
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchCategories();

    // Create a unique channel name to avoid conflicts
    const channelName = `categories-changes-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set up real-time subscription for categories
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'categories'
        },
        (payload) => {
          logger.debug('Categories real-time update', { event: payload.eventType });
          // Refetch categories when any change occurs
          fetchCategories();
        }
      )
      .subscribe();

    return () => {
      // Properly cleanup the channel
      supabase.removeChannel(channel);
    };
  }, [fetchCategories]);

  return {
    categories,
    loading,
    fetchCategories,
    createCategory,
    updateCategory,
  };
}

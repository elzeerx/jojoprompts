import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Category } from "@/types/category";
import { toast } from "@/hooks/use-toast";
import { createLogger } from '@/utils/logging';

const logger = createLogger('CATEGORIES');

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
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
    } catch (error: any) {
      logger.error('Failed to fetch categories', { error: error.message || error });
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async (categoryData: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => {
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
    } catch (error: any) {
      logger.error('Failed to create category', { error: error.message || error });
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
    } catch (error: any) {
      logger.error('Failed to update category', { error: error.message || error, categoryId: id });
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await fetchCategories();
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    } catch (error: any) {
      logger.error('Failed to delete category', { error: error.message || error, categoryId: id });
      toast({
        title: "Error",
        description: "Failed to delete category",
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
  }, []);

  return {
    categories,
    loading,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}

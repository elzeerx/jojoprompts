/**
 * usePlatforms Hook
 * 
 * React hook for fetching and managing platform configurations.
 * Provides access to all platforms, individual platforms with their fields,
 * and platform templates.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Platform, PlatformWithFields, PlatformField, PromptTemplate } from '@/types/platform';

/**
 * Fetch all active platforms
 */
export function usePlatforms() {
  return useQuery({
    queryKey: ['platforms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platforms')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as unknown as Platform[];
    },
  });
}

/**
 * Fetch all platforms including inactive ones (admin use)
 */
export function useAllPlatforms() {
  return useQuery({
    queryKey: ['platforms', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platforms')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as unknown as Platform[];
    },
  });
}

/**
 * Fetch a single platform by slug
 */
export function usePlatform(slug: string) {
  return useQuery({
    queryKey: ['platforms', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platforms')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      return data as unknown as Platform;
    },
    enabled: !!slug,
  });
}

/**
 * Fetch a platform with all its fields
 */
export function usePlatformWithFields(platformId: string) {
  return useQuery({
    queryKey: ['platforms', platformId, 'with-fields'],
    queryFn: async () => {
      // Fetch platform
      const { data: platform, error: platformError } = await supabase
        .from('platforms')
        .select('*')
        .eq('id', platformId)
        .single();

      if (platformError) throw platformError;

      // Fetch fields
      const { data: fields, error: fieldsError } = await supabase
        .from('platform_fields')
        .select('*')
        .eq('platform_id', platformId)
        .order('display_order', { ascending: true });

      if (fieldsError) throw fieldsError;

      return {
        ...platform,
        fields: fields as unknown as PlatformField[],
      } as unknown as PlatformWithFields;
    },
    enabled: !!platformId,
  });
}

/**
 * Fetch a platform with fields by slug
 */
export function usePlatformWithFieldsBySlug(slug: string) {
  return useQuery({
    queryKey: ['platforms', 'slug', slug, 'with-fields'],
    queryFn: async () => {
      // Fetch platform by slug
      const { data: platform, error: platformError } = await supabase
        .from('platforms')
        .select('*')
        .eq('slug', slug)
        .single();

      if (platformError) throw platformError;

      // Fetch fields
      const { data: fields, error: fieldsError } = await supabase
        .from('platform_fields')
        .select('*')
        .eq('platform_id', (platform as any).id)
        .order('display_order', { ascending: true });

      if (fieldsError) throw fieldsError;

      return {
        ...platform,
        fields: fields as unknown as PlatformField[],
      } as unknown as PlatformWithFields;
    },
    enabled: !!slug,
  });
}

/**
 * Fetch all fields for a specific platform
 */
export function usePlatformFields(platformId: string) {
  return useQuery({
    queryKey: ['platform-fields', platformId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_fields')
        .select('*')
        .eq('platform_id', platformId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as unknown as PlatformField[];
    },
    enabled: !!platformId,
  });
}

/**
 * Fetch templates for a specific platform
 */
export function usePlatformTemplates(platformId: string) {
  return useQuery({
    queryKey: ['prompt-templates', platformId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('platform_id', platformId);

      if (error) throw error;
      return data as unknown as PromptTemplate[];
    },
    enabled: !!platformId,
  });
}

/**
 * Fetch featured templates for a specific platform
 */
export function useFeaturedTemplates(platformId: string) {
  return useQuery({
    queryKey: ['prompt-templates', platformId, 'featured'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('platform_id', platformId)
        .eq('is_featured', true);

      if (error) throw error;
      return data as unknown as PromptTemplate[];
    },
    enabled: !!platformId,
  });
}

/**
 * Fetch platforms by category
 */
export function usePlatformsByCategory(category: string) {
  return useQuery({
    queryKey: ['platforms', 'category', category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platforms')
        .select('*')
        .eq('category', category)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as unknown as Platform[];
    },
    enabled: !!category,
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminUserDTO, AdminUsersResponse } from "@/types/admin-user.dto";

interface UseFetchUsersParams {
  page?: number;
  limit?: number;
  search?: string;
}

interface UseFetchUsersReturn {
  users: AdminUserDTO[];
  loading: boolean;
  error: string | null;
  total: number;
  totalPages: number;
  currentPage: number;
  refetch: () => void;
  performance?: {
    duration_ms: number;
    query_count?: number;
    cached?: boolean;
  };
}

export function useFetchUsers({ page = 1, limit = 10, search = "" }: UseFetchUsersParams = {}): UseFetchUsersReturn {
  const { session, loading: authLoading } = useAuth();

  const {
    data,
    isLoading,
    error,
    refetch,
    isError
  } = useQuery({
    queryKey: ['admin-users-v2', page, limit, search],
    queryFn: async () => {
      if (!session?.access_token) {
        throw new Error("Authentication required");
      }

      console.log(`[UserFetch] Calling admin-users-v2 - page: ${page}, limit: ${limit}, search: "${search}"`);
      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) {
        params.set('search', search);
      }

      // Call the new optimized edge function with query parameters
      const supabaseUrl = 'https://fxkqgjakbyrxkmevkglv.supabase.co';
      const url = `${supabaseUrl}/functions/v1/admin-users-v2?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[UserFetch] Edge function error:', errorData);
        throw new Error(errorData.error || 'Failed to fetch users');
      }

      const result = await response.json();

      console.log(`[UserFetch] Success - fetched ${result.users?.length || 0} users (cached: ${result.performance?.cached || false})`);
      
      // Response already matches AdminUsersResponse structure
      return {
        users: result.users || [],
        total: result.pagination?.total || 0,
        totalPages: result.pagination?.totalPages || 0,
        performance: result.performance
      };
    },
    enabled: !authLoading && !!session?.access_token,
    retry: 1, // Only retry once on failure
    staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
  });

  return {
    users: data?.users || [],
    loading: isLoading,
    error: isError ? error?.message || "Failed to fetch users" : null,
    total: data?.total || 0,
    totalPages: data?.totalPages || 0,
    currentPage: page,
    refetch,
    performance: data?.performance
  };
}
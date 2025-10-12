import { useQuery } from "@tanstack/react-query";
import { UserProfile, UserRole } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface UseFetchUsersParams {
  page?: number;
  limit?: number;
  search?: string;
}

interface UseFetchUsersReturn {
  users: (UserProfile & { 
    email?: string;
    email_confirmed_at?: string | null;
    is_email_confirmed?: boolean;
    last_sign_in_at?: string | null;
    auth_created_at?: string | null;
    auth_updated_at?: string | null;
    subscription?: { 
      plan_id?: string;
      plan_name: string;
      price_usd: number;
      is_lifetime: boolean;
      status: string;
      start_date?: string;
      end_date?: string;
      payment_method?: string;
      subscription_created_at?: string;
      duration_days?: number;
    } | null;
  })[];
  loading: boolean;
  error: string | null;
  total: number;
  totalPages: number;
  currentPage: number;
  refetch: () => void;
  retryCount?: number;
  performance?: {
    requestId: string;
    totalDuration: number;
    cacheHit: boolean;
    searchActive: boolean;
    dataEnrichment?: {
      profilesEnriched: number;
      authDataAvailable: number;
      subscriptionsAvailable: number;
    };
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
      
      // Map the response to match our interface
      const enrichedUsers = result.users?.map((user: any) => ({
        ...user,
        role: user.role as UserRole,
        social_links: user.social_links || {},
        email_confirmed_at: user.email_confirmed_at,
        is_email_confirmed: !!user.email_confirmed_at,
        auth_created_at: user.created_at,
        auth_updated_at: user.created_at,
        subscription: user.subscription ? {
          plan_id: user.subscription.plan_id,
          plan_name: user.subscription.plan_name || 'Unknown',
          price_usd: user.subscription.price_usd || 0,
          is_lifetime: user.subscription.is_lifetime || false,
          status: user.subscription.status,
          start_date: user.subscription.start_date,
          end_date: user.subscription.end_date,
          payment_method: user.subscription.payment_method,
          subscription_created_at: user.subscription.created_at,
          duration_days: user.subscription.duration_days
        } : null
      })) || [];

      return {
        users: enrichedUsers,
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
    retryCount: 0, // React Query handles retries internally
    performance: data?.performance
  };
}
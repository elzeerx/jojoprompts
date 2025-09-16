import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { UserProfile } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

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
    queryKey: ['admin-users', page, limit, search],
    queryFn: async () => {
      if (!session?.access_token) {
        throw new Error("No admin session token; please log in or refresh.");
      }

      // Build query parameters for server-side pagination
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      
      if (search) {
        params.append('search', search);
      }

      // Create the function URL with query parameters
      const functionUrl = `get-all-users?${params.toString()}`;

      const { data: result, error: usersError } = await supabase.functions.invoke(
        functionUrl,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          method: "GET"
        }
      );

      if (usersError) {
        // Handle page redirect for out-of-range pages
        if (usersError.status === 416 && result?.redirect) {
          console.log('Page out of range, redirecting to last available page');
          toast({
            title: "Page not found",
            description: `Redirecting to page ${result.redirect.page} (last available page)`,
            variant: "default"
          });
          throw new Error(`PAGE_REDIRECT:${result.redirect.page}`);
        }
        
        // Handle unauthorized/forbidden with a helpful toast
        if (usersError.status === 401 || usersError.status === 403) {
          toast({
            title: "Admin authentication failed",
            description: "You are not authorized. Please log out and log in as an admin.",
            variant: "destructive"
          });
          throw new Error("Unauthorized. Only admins can access this section.");
        }
        
        throw usersError;
      }

      return result;
    },
    enabled: !authLoading && !!session?.access_token,
    retry: (failureCount, error) => {
      // Don't retry auth errors or redirect errors
      if (error?.message?.includes('Unauthorized') || 
          error?.message?.includes('PAGE_REDIRECT')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30000, // Cache for 30 seconds
  });

  // Handle errors with useEffect instead of onError callback
  useEffect(() => {
    if (isError && error) {
      console.error("Error fetching users:", error);
      
      if (error?.message?.includes("token") || error?.message?.includes("auth")) {
        toast({
          title: "Session expired",
          description: "Please log out and log in again as admin.",
          variant: "destructive"
        });
      } else if (error?.message?.includes("Network")) {
        toast({
          title: "Network error",
          description: "Failed to fetch users. Please check your connection.",
          variant: "destructive"
        });
      } else if (!error?.message?.includes('PAGE_REDIRECT')) {
        toast({
          title: "Error fetching users",
          description: error?.message || "An unexpected error occurred",
          variant: "destructive"
        });
      }
    }
  }, [isError, error]);

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
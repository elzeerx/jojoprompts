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

      try {
        // PRIMARY METHOD: Try Edge Function first
        console.log('[UserFetch] Attempting to fetch users via Edge Function...');
        
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
          console.error('[UserFetch] Edge Function error:', usersError);
          
          // Handle page redirect for out-of-range pages
          if (usersError.status === 416 && result?.redirect) {
            console.log('[UserFetch] Page out of range, redirecting');
            toast({
              title: "Page not found",
              description: `Redirecting to page ${result.redirect.page}`,
              variant: "default"
            });
            throw new Error(`PAGE_REDIRECT:${result.redirect.page}`);
          }
          
          // For 401/403 errors, try fallback to direct API
          if (usersError.status === 401 || usersError.status === 403) {
            console.warn('[UserFetch] Edge Function auth failed, trying direct API fallback...');
            throw new Error('EDGE_FUNCTION_AUTH_FAILED');
          }
          
          throw usersError;
        }

        console.log('[UserFetch] Successfully fetched users via Edge Function');
        return result;
        
      } catch (edgeFunctionError: any) {
        // FALLBACK METHOD: Direct Supabase queries when Edge Function fails
        if (edgeFunctionError.message === 'EDGE_FUNCTION_AUTH_FAILED') {
          console.log('[UserFetch] Using direct Supabase API fallback...');
          
          toast({
            title: "Using fallback method",
            description: "Edge Function unavailable, using direct database access",
            variant: "default",
            duration: 3000
          });
          
          try {
            // Calculate pagination
            const offset = (page - 1) * limit;
            
            // Build query for profiles with subscriptions
            let profileQuery = supabase
              .from('profiles')
              .select('*, user_subscriptions(*, subscription_plans(*))', { count: 'exact' })
              .order('created_at', { ascending: false })
              .range(offset, offset + limit - 1);
            
            // Add search filter if provided
            if (search) {
              profileQuery = profileQuery.or(`email.ilike.%${search}%,username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
            }
            
            const { data: profiles, error: profileError, count } = await profileQuery;
            
            if (profileError) {
              console.error('[UserFetch] Direct API profile fetch error:', profileError);
              throw new Error(`Database error: ${profileError.message}`);
            }
            
            // Fetch auth data for these users
            const userIds = profiles?.map(p => p.id) || [];
            const authUsers: any[] = [];
            
            for (const userId of userIds) {
              try {
                const { data: authData } = await supabase.auth.admin.getUserById(userId);
                if (authData?.user) {
                  authUsers.push(authData.user);
                }
              } catch (authError) {
                console.warn(`[UserFetch] Could not fetch auth data for user ${userId}:`, authError);
              }
            }
            
            // Merge profile and auth data
            const enrichedUsers = profiles?.map(profile => {
              const authUser = authUsers.find(u => u.id === profile.id);
              const subscriptions = Array.isArray(profile.user_subscriptions) 
                ? profile.user_subscriptions 
                : (profile.user_subscriptions ? [profile.user_subscriptions] : []);
              const subscription = subscriptions[0];
              const plan = subscription?.subscription_plans;
              
              return {
                ...profile,
                email: authUser?.email || profile.email,
                email_confirmed_at: authUser?.email_confirmed_at,
                is_email_confirmed: !!authUser?.email_confirmed_at,
                last_sign_in_at: authUser?.last_sign_in_at,
                auth_created_at: authUser?.created_at,
                auth_updated_at: authUser?.updated_at,
                subscription: subscription ? {
                  plan_id: subscription.plan_id,
                  plan_name: plan?.name || 'Unknown',
                  price_usd: plan?.price_usd || 0,
                  is_lifetime: plan?.is_lifetime || false,
                  status: subscription.status,
                  start_date: subscription.start_date,
                  end_date: subscription.end_date,
                  payment_method: subscription.payment_method,
                  subscription_created_at: subscription.created_at,
                  duration_days: plan?.duration_days
                } : null
              };
            }) || [];
            
            console.log(`[UserFetch] Successfully fetched ${enrichedUsers.length} users via direct API`);
            
            return {
              users: enrichedUsers,
              total: count || 0,
              totalPages: Math.ceil((count || 0) / limit),
              performance: {
                requestId: `fallback-${Date.now()}`,
                totalDuration: 0,
                cacheHit: false,
                searchActive: !!search
              }
            };
            
          } catch (fallbackError: any) {
            console.error('[UserFetch] Direct API fallback also failed:', fallbackError);
            throw new Error(`Both Edge Function and direct API failed: ${fallbackError.message}`);
          }
        }
        
        // Re-throw other errors
        throw edgeFunctionError;
      }
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
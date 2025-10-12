import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { UserProfile, UserRole } from "@/types";
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

      // PRIMARY METHOD: Try edge function first
      try {
        console.log(`[UserFetch] Calling edge function - page: ${page}, limit: ${limit}, search: "${search}"`);
        
        const supabaseUrl = 'https://fxkqgjakbyrxkmevkglv.supabase.co';
        const url = new URL(`${supabaseUrl}/functions/v1/get-all-users`);
        url.searchParams.set('page', page.toString());
        url.searchParams.set('limit', limit.toString());
        if (search) {
          url.searchParams.set('search', search);
        }

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[UserFetch] Edge function error:', { 
            status: response.status, 
            statusText: response.statusText,
            error: errorData 
          });
          throw new Error(`Edge function failed: ${response.status} ${errorData.error || response.statusText}`);
        }

        const result = await response.json();
        console.log(`[UserFetch] Edge function success - fetched ${result.users?.length || 0} users`);
        
        return {
          users: result.users || [],
          total: result.total || 0,
          totalPages: result.totalPages || 0,
          performance: result.performance
        };

      } catch (edgeFunctionError: any) {
        console.warn('[UserFetch] Edge function failed, falling back to direct database queries:', edgeFunctionError.message);
        
        // Show toast to inform user of fallback
        toast({
          title: "Using Fallback Method",
          description: "Edge function unavailable, using direct database access.",
          variant: "default"
        });
        
        // FALLBACK METHOD: Direct database queries
        try {
          console.log('[UserFetch] Using direct database queries as fallback...');
          
          const offset = (page - 1) * limit;
          
          let profileQuery = supabase
            .from('profiles')
            .select('*, user_subscriptions(*, subscription_plans(*))', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
          
          if (search) {
            profileQuery = profileQuery.or(`email.ilike.%${search}%,username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
          }
          
          const { data: profiles, error: profileError, count } = await profileQuery;
          
          if (profileError) {
            console.error('[UserFetch] Database query error:', profileError);
            throw new Error(`Database error: ${profileError.message}`);
          }
          
          console.log(`[UserFetch] Fallback successful - fetched ${profiles?.length || 0} profiles from database`);
          
          const enrichedUsers = profiles?.map(profile => {
            const subscriptions = Array.isArray(profile.user_subscriptions) 
              ? profile.user_subscriptions 
              : (profile.user_subscriptions ? [profile.user_subscriptions] : []);
            const subscription = subscriptions[0];
            const plan = subscription?.subscription_plans;
            
            return {
              ...profile,
              role: profile.role as UserRole,
              social_links: profile.social_links as any,
              email: profile.email || 'No email',
              email_confirmed_at: null,
              is_email_confirmed: false,
              last_sign_in_at: null,
              auth_created_at: profile.created_at,
              auth_updated_at: profile.created_at,
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
          
          return {
            users: enrichedUsers,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
            performance: {
              requestId: `fallback-db-${Date.now()}`,
              totalDuration: 0,
              cacheHit: false,
              searchActive: !!search
            }
          };
          
        } catch (dbError: any) {
          console.error('[UserFetch] Fallback database query also failed:', dbError);
          throw new Error(`Both edge function and database fallback failed: ${dbError.message}`);
        }
      }
    },
    enabled: !authLoading && !!session?.access_token,
    retry: (failureCount, error) => {
      // Don't retry auth errors
      if (error?.message?.includes('No admin session token')) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30000, // Cache for 30 seconds
  });

  // Handle errors with useEffect instead of onError callback
  useEffect(() => {
    if (isError && error) {
      console.error("Error fetching users:", error);
      
      if (error?.message?.includes("No admin session token")) {
        toast({
          title: "Authentication Required",
          description: "Please log in as an admin to view users.",
          variant: "destructive"
        });
      } else if (error?.message?.includes("Database error")) {
        toast({
          title: "Database Error",
          description: "Failed to fetch users from database. Click retry to try again.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error fetching users",
          description: error?.message || "An unexpected error occurred. Click retry to try again.",
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
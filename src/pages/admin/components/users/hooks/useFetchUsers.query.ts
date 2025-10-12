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

      console.log('[UserFetch] Using direct database queries (bypassing edge functions)...');
      
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
          console.error('[UserFetch] Database query error:', profileError);
          throw new Error(`Database error: ${profileError.message}`);
        }
        
        console.log(`[UserFetch] Fetched ${profiles?.length || 0} profiles from database`);
        
        // Enrich with auth data (email, confirmation status, last sign in)
        // Note: This requires proper RLS policies or service role access
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
            email_confirmed_at: null, // Would need service role to fetch
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
        
        console.log(`[UserFetch] Successfully enriched ${enrichedUsers.length} users`);
        
        return {
          users: enrichedUsers,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          performance: {
            requestId: `direct-db-${Date.now()}`,
            totalDuration: 0,
            cacheHit: false,
            searchActive: !!search
          }
        };
        
      } catch (dbError: any) {
        console.error('[UserFetch] Database query failed:', dbError);
        throw new Error(`Failed to fetch users: ${dbError.message}`);
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
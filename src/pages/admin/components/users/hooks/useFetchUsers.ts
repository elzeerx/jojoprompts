
import { useState, useEffect, useCallback } from "react";
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
  users: (UserProfile & { subscription?: { plan_name: string } | null })[];
  loading: boolean;
  error: string | null;
  total: number;
  totalPages: number;
  currentPage: number;
  fetchUsers: () => void;
  retryCount: number;
  performance?: {
    requestId: string;
    totalDuration: number;
    cacheHit: boolean;
    searchActive: boolean;
  };
}

export function useFetchUsers({ page = 1, limit = 10, search = "" }: UseFetchUsersParams = {}): UseFetchUsersReturn {
  const [users, setUsers] = useState<(UserProfile & { subscription?: { plan_name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [performance, setPerformance] = useState<any>(null);

  const { session, loading: authLoading } = useAuth();

  // Enhanced retry logic with exponential backoff
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  const retryOperation = async (operation: () => Promise<any>, maxRetries = 3): Promise<any> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        console.log(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff: wait 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
        setRetryCount(attempt);
      }
    }
  };

  const fetchUsers = useCallback(async () => {
    const startTime = Date.now();
    
    try {
      setLoading(true);
      setError(null);
      setRetryCount(0);

      if (!session?.access_token) {
        setError("No admin session token; please log in or refresh.");
        return;
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

      // Use retry logic for the main API call
      const usersFunctionData = await retryOperation(async () => {
        const { data, error: usersError } = await supabase.functions.invoke(
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
          if (usersError.status === 416 && data?.redirect) {
            console.log('Page out of range, redirecting to last available page');
            toast({
              title: "Page not found",
              description: `Redirecting to page ${data.redirect.page} (last available page)`,
              variant: "default"
            });
            
            // Update the page and let useEffect handle the refetch
            // Note: This requires parent component to handle page updates
            return null; // Signal to parent to update page
          }
          
          // Handle unauthorized/forbidden with a helpful toast
          if (usersError.status === 401 || usersError.status === 403) {
            toast({
              title: "Admin authentication failed",
              description: "You are not authorized. Please log out and log in as an admin.",
              variant: "destructive"
            });
            throw new Error(usersError.message || "Unauthorized. Only admins can access this section.");
          }
          
          throw usersError;
        }

        return data;
      });

      if (!usersFunctionData) {
        // Handle redirect case - don't continue processing
        return;
      }

      // Enhancement: Get user subscriptions with retry logic
      const subscriptions = await retryOperation(async () => {
        const { data, error: subscriptionsError } = await supabase
          .from('user_subscriptions')
          .select('user_id, plan_id(id, name), created_at')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (subscriptionsError) throw subscriptionsError;
        return data;
      });

      // Map subscriptions to users - get most recent subscription per user
      const usersWithSubscriptions = usersFunctionData.users.map((user: UserProfile) => {
        // Find the most recent subscription for this user
        const userSubscriptions = subscriptions?.filter((sub: any) => sub.user_id === user.id) || [];
        const latestSubscription = userSubscriptions.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        return {
          ...user,
          subscription: latestSubscription ? { plan_name: latestSubscription.plan_id?.name } : null
        };
      });

      setUsers(usersWithSubscriptions || []);
      setTotal(usersFunctionData.total || 0);
      setTotalPages(usersFunctionData.totalPages || 0);
      setPerformance(usersFunctionData.performance);
      
      // Log successful operation
      const duration = Date.now() - startTime;
      console.log(`Successfully fetched ${usersWithSubscriptions.length} users in ${duration}ms`, {
        page,
        limit,
        search,
        total: usersFunctionData.total,
        performance: usersFunctionData.performance
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`Error fetching users after ${duration}ms:`, error);
      
      // Enhanced error handling with different strategies based on error type
      if (error?.message?.includes("token") || error?.message?.includes("auth")) {
        toast({
          title: "Session expired",
          description: "Please log out and log in again as admin.",
          variant: "destructive"
        });
        setError("Authentication failed - please log in again");
      } else if (error?.message?.includes("Network")) {
        toast({
          title: "Network error",
          description: `Failed to fetch users (${retryCount + 1} attempts). Please check your connection.`,
          variant: "destructive"
        });
        setError(`Network error after ${retryCount + 1} attempts`);
      } else {
        toast({
          title: "Error fetching users",
          description: error.message || "An unexpected error occurred",
          variant: "destructive"
        });
        setError(error.message || "Failed to fetch users");
      }
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, page, limit, search, retryCount]);

  useEffect(() => {
    if (!authLoading) {
      fetchUsers();
    }
  }, [fetchUsers, authLoading]);

  return { 
    users, 
    loading, 
    error, 
    total,
    totalPages,
    currentPage: page,
    fetchUsers,
    retryCount,
    performance
  };
}

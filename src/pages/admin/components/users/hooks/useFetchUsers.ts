
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { UserProfile } from "@/types";

export function useFetchUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!session) {
        toast({
          title: "Error fetching users",
          description: "You need to be logged in to view users",
          variant: "destructive",
        });
        setLoading(false);
        setError("Authentication required");
        return;
      }
      
      console.log("Fetching users with session:", session.access_token.substring(0, 10) + "...");
      
      // Get users from the edge function
      const { data: authUsersData, error: functionError } = await supabase.functions.invoke(
        "get-all-users",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: { action: "list" },
        }
      );
      
      if (functionError) {
        console.error("Error fetching users from edge function:", functionError);
        throw new Error(functionError.message || "Failed to fetch users");
      }
      
      if (!Array.isArray(authUsersData)) {
        if (authUsersData && authUsersData.error) {
          throw new Error(authUsersData.error + (authUsersData.details ? `: ${authUsersData.details}` : ''));
        }
        throw new Error("Invalid response format from server");
      }
      
      console.log("Auth users data fetched:", authUsersData);
      
      // If no users found, return early
      if (authUsersData.length === 0) {
        console.log("No users found");
        setUsers([]);
        setLoading(false);
        return;
      }
      
      // Get user IDs from auth users data
      const userIds = authUsersData.map((user: any) => user.id);
      
      // Fetch profiles with latest role data
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, role, first_name, last_name')
        .in('id', userIds);
        
      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }
      
      console.log("Profiles data fetched:", profilesData);
      
      // Create a map of user IDs to their profiles for efficient lookups
      const userProfiles = new Map(
        profilesData?.map(profile => [profile.id, {
          role: profile.role || 'user',
          first_name: profile.first_name,
          last_name: profile.last_name
        }]) || []
      );
      
      // Combine auth users with their profiles, defaulting to 'user' if no profile found
      const combinedUsers: UserProfile[] = authUsersData.map((user: any) => {
        const profile = userProfiles.get(user.id) || { role: 'user', first_name: null, last_name: null };
        
        // Debug data
        console.log(`User ${user.id} profile data:`, profile);
        
        return {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          role: profile.role,
          first_name: profile.first_name,
          last_name: profile.last_name,
          last_sign_in_at: user.last_sign_in_at
        };
      });
      
      console.log("Combined users data:", combinedUsers);
      setUsers(combinedUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      const errorMessage = error.message || "An unknown error occurred";
      setError(errorMessage);
      toast({
        title: "Error fetching users",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, loading, error, fetchUsers };
}

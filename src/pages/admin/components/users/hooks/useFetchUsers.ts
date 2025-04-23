
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  role: string;
  last_sign_in_at: string | null;
}

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
      
      // Get fresh role data directly from profiles table to ensure we have the latest roles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, role');
        
      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }
      
      console.log("Profiles data fetched:", profilesData);
      
      // Create a map of user IDs to their roles
      const userRoles = new Map(
        profilesData?.map(profile => [profile.id, profile.role]) || []
      );
      
      // Combine auth users with their roles
      const combinedUsers: UserProfile[] = authUsersData.map((user: any) => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        role: userRoles.get(user.id) || 'user',
        last_sign_in_at: user.last_sign_in_at
      }));
      
      console.log("Combined users data:", combinedUsers);
      setUsers(combinedUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      const errorMessage = error.message.includes("admin privileges") 
        ? "You need Supabase admin privileges to access user data. Please check your role in Supabase or contact the system administrator."
        : error.message;
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

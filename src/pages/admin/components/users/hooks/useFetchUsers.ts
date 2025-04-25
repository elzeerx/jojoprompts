
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
      
      if (!session || !session.access_token) {
        console.error("No valid session found for admin operation");
        toast({
          title: "Authentication error",
          description: "Please log in again to access admin functions",
          variant: "destructive",
        });
        setLoading(false);
        setError("Authentication required - Please log in again");
        return;
      }
      
      console.log("Fetching users with session token");
      
      const { data: users, error: functionError } = await supabase.functions.invoke(
        "get-all-users",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: { action: "list" },
        }
      );
      
      if (functionError) {
        console.error("Error fetching users:", functionError);
        throw new Error(functionError.message || "Failed to fetch users");
      }
      
      if (!Array.isArray(users)) {
        if (users && users.error) {
          throw new Error(users.error + (users.details ? `: ${users.details}` : ''));
        }
        throw new Error("Invalid response format from server");
      }
      
      console.log("Received users data:", users);
      setUsers(users);
    } catch (error: any) {
      console.error("Error in fetchUsers:", error);
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
    if (session) {
      fetchUsers();
    }
  }, [fetchUsers, session]);

  return { users, loading, error, fetchUsers };
}

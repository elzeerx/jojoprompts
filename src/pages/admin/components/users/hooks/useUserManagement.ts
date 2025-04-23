
import { useState, useEffect } from "react";
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

export function useUserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const { session } = useAuth();

  const fetchUsers = async () => {
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
      
      const { data, error } = await supabase.functions.invoke(
        "get-all-users",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      
      if (error) {
        console.error("Error fetching users from edge function:", error);
        throw new Error(error.message || "Failed to fetch users");
      }
      
      if (!Array.isArray(data)) {
        if (data.error) {
          throw new Error(data.error + (data.details ? `: ${data.details}` : ''));
        }
        throw new Error("Invalid response format from server");
      }
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, role');
        
      if (profilesError) throw profilesError;
      
      const userRoles = new Map(
        profilesData?.map(profile => [profile.id, profile.role]) || []
      );
      
      const combinedUsers: UserProfile[] = data.map((user: any) => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        role: userRoles.get(user.id) || 'user',
        last_sign_in_at: user.last_sign_in_at
      }));
      
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
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      setUpdatingUserId(userId);
      
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
        
      if (error) throw error;
      
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      
      toast({
        title: "Role updated",
        description: `User role has been changed to ${newRole}`,
      });
    } catch (error: any) {
      console.error("Error updating user role:", error);
      toast({
        title: "Error updating role",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const sendPasswordResetEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      toast({
        title: "Password reset email sent",
        description: `An email has been sent to ${email}`,
      });
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      toast({
        title: "Error sending email",
        description: error.message || "Failed to send password reset email",
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user: ${email}? This action cannot be undone.`)) {
      return;
    }

    setUpdatingUserId(userId);
    try {
      if (!session) {
        toast({
          title: "Authentication Error",
          description: "Admin authentication is required for user deletion.",
          variant: "destructive",
        });
        return;
      }
      
      const { data, error } = await supabase.functions.invoke(
        "get-all-users",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: { userId, action: "delete" }
        }
      );

      if (error || (data && data.error)) {
        throw new Error(error?.message || data?.error || "Error deleting user");
      }
      
      toast({
        title: "User Deleted",
        description: `User ${email} has been permanently deleted.`,
      });

      setUsers(users.filter(user => user.id !== userId));

    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    error,
    updatingUserId,
    fetchUsers,
    updateUserRole,
    sendPasswordResetEmail,
    deleteUser
  };
}

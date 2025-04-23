
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { CreateUserDialog } from "./CreateUserDialog";
import { UserSearch } from "./UserSearch";
import { UsersTable } from "./UsersTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  role: string;
  last_sign_in_at: string | null;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

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
      
      // Call the edge function to get users
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
        // This might be an error response from our edge function
        if (data.error) {
          throw new Error(data.error + (data.details ? `: ${data.details}` : ''));
        }
        throw new Error("Invalid response format from server");
      }
      
      // Fetch roles from profiles table
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, role');
        
      if (profilesError) throw profilesError;
      
      // Create a map of user IDs to roles
      const userRoles = new Map(
        profilesData?.map(profile => [profile.id, profile.role]) || []
      );
      
      // Combine the user data with roles
      const combinedUsers: UserProfile[] = data.map((user: any) => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        role: userRoles.get(user.id) || 'user', // Default to 'user' if no role found
        last_sign_in_at: user.last_sign_in_at
      }));
      
      setUsers(combinedUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      
      // Format the error message to be user-friendly
      let errorMessage = "Failed to load users";
      if (error.message && error.message.includes("admin privileges")) {
        errorMessage = "You need Supabase admin privileges to access user data. Please check your role in Supabase or contact the system administrator.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
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
      
      // Use the edge function to delete the user
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

      // Remove the user from the local state
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

  const retryFetchUsers = () => {
    fetchUsers();
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">User Management</h3>
        <div className="flex items-center gap-4">
          <UserSearch 
            searchTerm={searchTerm} 
            onSearchChange={setSearchTerm} 
          />
          <CreateUserDialog onUserCreated={fetchUsers} />
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            {error.includes("admin privileges") && (
              <Button 
                variant="link" 
                className="p-0 h-auto text-destructive-foreground hover:text-destructive-foreground/80 ml-2"
                onClick={retryFetchUsers}
              >
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border">
          <UsersTable 
            users={filteredUsers} 
            updatingUserId={updatingUserId}
            onUpdateRole={updateUserRole}
            onSendResetEmail={sendPasswordResetEmail}
            onDeleteUser={deleteUser}
          />
        </div>
      )}
    </div>
  );
}

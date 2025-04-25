
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useFetchUsers } from "./useFetchUsers";
import { useUserRoleManagement } from "./useUserRoleManagement";
import { UserProfile } from "@/types";

interface UserUpdateData {
  first_name?: string | null;
  last_name?: string | null;
  role?: string;
  email?: string;
}

export function useUserManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const { users, loading, error, fetchUsers } = useFetchUsers();
  const { updatingUserId, updateUserRole } = useUserRoleManagement();
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const handleUpdateUser = async (userId: string, data: UserUpdateData) => {
    try {
      setProcessingUserId(userId);
      
      // If only role is being updated and no other fields, use existing function
      if (data.role && !data.first_name && !data.last_name && !data.email) {
        await updateUserRole(userId, data.role);
        await fetchUsers();
        return;
      }

      console.log("Updating user with data:", data);
      
      // Use the edge function to update the user
      const { data: updateResult, error: updateError } = await supabase.functions.invoke(
        "get-all-users",
        {
          body: { 
            userId,
            action: "update",
            userData: data
          }
        }
      );

      if (updateError) throw updateError;
      if (updateResult?.error) throw new Error(updateResult.error);
      
      console.log("Update result:", updateResult);

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      await fetchUsers();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setProcessingUserId(null);
    }
  };

  const sendPasswordResetEmail = async (email: string) => {
    try {
      // Get the current origin with protocol
      const origin = window.location.origin;
      const resetUrl = `${origin}/reset-password`; // Use a dedicated reset password page

      console.log(`Sending password reset email to ${email} with redirect URL: ${resetUrl}`);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
      });
      
      if (error) throw error;
      
      toast({
        title: "Reset email sent",
        description: `Password reset email has been sent to ${email}`,
      });
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    try {
      setProcessingUserId(userId);
      
      if (!window.confirm(`Are you sure you want to delete user: ${email}?`)) {
        return false;
      }

      const { data, error } = await supabase.functions.invoke(
        "get-all-users",
        {
          body: { 
            userId,
            action: "delete"
          }
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({
        title: "User deleted",
        description: `User ${email} has been permanently deleted.`,
      });

      await fetchUsers();
      return true;
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  return {
    users,
    loading,
    error,
    currentPage,
    totalPages: Math.ceil(users.length / pageSize),
    onPageChange: setCurrentPage,
    updatingUserId: updatingUserId || processingUserId,
    fetchUsers,
    updateUser: handleUpdateUser,
    sendPasswordResetEmail,
    deleteUser
  };
}

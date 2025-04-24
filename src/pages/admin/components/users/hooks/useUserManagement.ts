
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useFetchUsers } from "./useFetchUsers";
import { useUserRoleManagement } from "./useUserRoleManagement";

interface UserUpdateData {
  first_name?: string;
  last_name?: string;
  role?: string;
  email?: string;
}

export function useUserManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const { users, loading, error, fetchUsers } = useFetchUsers(currentPage, pageSize);
  const { updatingUserId, updateUserRole } = useUserRoleManagement();
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const handleUpdateUser = async (userId: string, data: UserUpdateData) => {
    try {
      setProcessingUserId(userId);
      
      // If role is being updated, use existing function
      if (data.role) {
        await updateUserRole(userId, data.role);
      }

      // Update profile data if provided
      if (data.first_name || data.last_name) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            first_name: data.first_name,
            last_name: data.last_name
          })
          .eq('id', userId);

        if (profileError) throw profileError;
      }

      // Update email if provided
      if (data.email) {
        const { error: emailError } = await supabase.auth.admin.updateUserById(
          userId,
          { email: data.email }
        );

        if (emailError) throw emailError;
      }

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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
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

      const { error } = await supabase.functions.invoke(
        "get-all-users",
        {
          body: { 
            userId,
            action: "delete"
          }
        }
      );

      if (error) throw error;
      
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

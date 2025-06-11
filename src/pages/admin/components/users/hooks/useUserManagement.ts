import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useFetchUsers } from "./useFetchUsers";
import { useUserRoleManagement } from "./useUserRoleManagement";
import { UserProfile } from "@/types";
import { validateRole, UserRole } from "@/utils/roleValidation";

interface UserUpdateData {
  first_name?: string | null;
  last_name?: string | null;
  role?: UserRole;
  email?: string;
}

export function useUserManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const { users, loading, error, fetchUsers } = useFetchUsers();
  const { updatingUserId, updateUserRole } = useUserRoleManagement();
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  const handleUpdateUser = async (userId: string, data: UserUpdateData) => {
    setProcessingUserId(userId);
    
    try {
      let updated = false;
      
      // Update roles if changed
      if (data.role) {
        const roleValidation = validateRole(data.role);
        if (!roleValidation.isValid) {
          throw new Error(roleValidation.error);
        }
        
        await updateUserRole(userId, data.role);
        updated = true;
      }

      // Update user profile data
      if (data.first_name !== undefined || data.last_name !== undefined) {
        const { error } = await supabase
          .from('profiles')
          .update({
            first_name: data.first_name,
            last_name: data.last_name,
          })
          .eq('id', userId);

        if (error) throw error;
        updated = true;
      }

      // Update user email if provided
      if (data.email) {
        const { error } = await supabase.functions.invoke(
          "get-all-users",
          {
            body: {
              action: 'update',
              userId,
              userData: { email: data.email }
            }
          }
        );

        if (error) throw error;
        updated = true;
      }
      
      if (updated) {
        toast({
          title: "User updated",
          description: "User information has been updated successfully."
        });
        
        // Refresh users list
        fetchUsers();
      }
    } catch (error: any) {
      console.error("Error updating user:", error);
      
      toast({
        title: "Update failed",
        description: error.message || "Failed to update user information.",
        variant: "destructive"
      });
    } finally {
      setProcessingUserId(null);
    }
  };
  
  const handleAssignPlanToUser = async (userId: string, planId: string) => {
    setProcessingUserId(userId);
    
    try {
      // Get plan details
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();
      
      if (planError) throw planError;
      
      // Calculate end date for non-lifetime plans
      let endDate = null;
      if (!planData.is_lifetime && planData.duration_days) {
        const startDate = new Date();
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + planData.duration_days);
      }
      
      // Check for existing subscription and update it
      const { data: existingSub, error: checkError } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') throw checkError;
      
      let operation;
      if (existingSub) {
        // Update existing subscription
        operation = supabase
          .from('user_subscriptions')
          .update({
            plan_id: planId,
            end_date: endDate,
            payment_method: 'admin_assigned', 
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSub.id)
          .select();
      } else {
        // Create new subscription
        operation = supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            plan_id: planId,
            start_date: new Date().toISOString(),
            end_date: endDate,
            status: 'active',
            payment_method: 'admin_assigned'
          })
          .select();
      }
      
      const { error: opError } = await operation;
      if (opError) throw opError;
      
      // Add to payment history with default KWD amount (convert USD to KWD if needed)
      const kwdAmount = planData.price_usd * 0.3; // Approximate conversion rate, should be configurable
      await supabase
        .from('payment_history')
        .insert({
          user_id: userId,
          payment_method: 'admin_assigned',
          status: 'completed',
          amount_usd: planData.price_usd,
          amount_kwd: kwdAmount
        });
      
      toast({
        title: "Plan assigned",
        description: `Successfully assigned ${planData.name} plan to the user.`
      });
      
      // Refresh users list
      fetchUsers();
    } catch (error: any) {
      console.error("Error assigning plan:", error);
      
      toast({
        title: "Assignment failed",
        description: error.message || "Failed to assign plan to user.",
        variant: "destructive"
      });
    } finally {
      setProcessingUserId(null);
    }
  };
  
  const handleSendPasswordResetEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?tab=reset`,
      });
      
      if (error) throw error;
      
      toast({
        title: "Email sent",
        description: "Password reset email has been sent successfully."
      });
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      
      toast({
        title: "Email not sent",
        description: error.message || "Failed to send password reset email.",
        variant: "destructive"
      });
    }
  };
  
  const handleDeleteUser = async (userId: string, email: string) => {
    setProcessingUserId(userId);
    
    try {
      const { error } = await supabase.functions.invoke(
        "get-all-users",
        {
          body: {
            action: 'delete',
            userId
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "User deleted",
        description: `User ${email} has been deleted successfully.`
      });
      
      // Remove user from local state
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      
      toast({
        title: "Deletion failed",
        description: error.message || "Failed to delete user.",
        variant: "destructive"
      });
    } finally {
      setProcessingUserId(null);
    }
  };

  // Calculate pagination values
  const totalPages = Math.ceil(users.length / pageSize);
  const paginatedUsers = users.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return {
    users: paginatedUsers,
    allUsers: users,
    loading,
    error,
    currentPage,
    totalPages,
    onPageChange: setCurrentPage,
    updatingUserId: processingUserId || updatingUserId,
    fetchUsers,
    updateUser: handleUpdateUser,
    assignPlanToUser: handleAssignPlanToUser,
    sendPasswordResetEmail: handleSendPasswordResetEmail,
    deleteUser: handleDeleteUser
  };
}

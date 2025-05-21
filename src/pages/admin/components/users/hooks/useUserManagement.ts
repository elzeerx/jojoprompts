
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
      
      if (data.role && !data.first_name && !data.last_name && !data.email) {
        await updateUserRole(userId, data.role);
        await fetchUsers();
        return;
      }

      console.log("Updating user with data:", data);
      
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

  const assignPlanToUser = async (userId: string, planId: string) => {
    try {
      setProcessingUserId(userId);

      // First, check if user already has an active subscription
      const { data: existingSubscription, error: fetchError } = await supabase
        .from("user_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      // Get the plan details
      const { data: plan, error: planError } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError) throw planError;
      if (!plan) throw new Error("Plan not found");

      // Calculate end date for non-lifetime plans
      let endDate = null;
      if (!plan.is_lifetime && plan.duration_days) {
        const date = new Date();
        date.setDate(date.getDate() + plan.duration_days);
        endDate = date.toISOString();
      }

      if (fetchError && fetchError.code !== 'PGRST116') { // Not found error is expected
        throw fetchError;
      }

      if (existingSubscription) {
        // Update existing subscription
        const { error: updateError } = await supabase
          .from("user_subscriptions")
          .update({
            plan_id: planId,
            end_date: endDate,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingSubscription.id);

        if (updateError) throw updateError;
      } else {
        // Create new subscription
        const { error: insertError } = await supabase
          .from("user_subscriptions")
          .insert({
            user_id: userId,
            plan_id: planId,
            payment_method: "admin_assigned",
            status: "active",
            end_date: endDate
          });

        if (insertError) throw insertError;

        // Create payment history record
        await supabase
          .from("payment_history")
          .insert({
            user_id: userId,
            amount_usd: plan.price_usd,
            amount_kwd: plan.price_kwd,
            payment_method: "admin_assigned",
            status: "completed",
            payment_id: `admin-${Date.now()}`
          });
      }

      toast({
        title: "Plan Assigned",
        description: `Successfully assigned ${plan.name} plan to the user`,
      });

      await fetchUsers();
      return true;
    } catch (error: any) {
      console.error("Error assigning plan:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign plan to user",
        variant: "destructive",
      });
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  const sendPasswordResetEmail = async (email: string) => {
    try {
      const origin = window.location.origin;
      const resetUrl = `${origin}/login?tab=reset`;
      
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
    assignPlanToUser,
    sendPasswordResetEmail,
    deleteUser
  };
}

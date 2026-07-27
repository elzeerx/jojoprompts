import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CreateUserData, UserUpdateData, UserRole } from "@/types/user";
import { validateRole } from "@/utils/roleValidation";
import { callEdgeFunction } from "@/utils/edgeFunctions";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('USER_SERVICE');

/**
 * Consolidated hook for all user CRUD operations
 * Replaces: useUserCreation, useUserUpdate, useUserDeletion, useUserRoleManagement, 
 * usePasswordReset, useEmailConfirmation, usePlanAssignment, useSubscriptionActions
 */
export function useUserService() {
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { session } = useAuth();

  // Transform frontend field names to edge function expected format
  const transformDataForEdgeFunction = (data: UserUpdateData) => {
    const transformed: Record<string, any> = {};
    
    if (data.first_name !== undefined) transformed.firstName = data.first_name;
    if (data.last_name !== undefined) transformed.lastName = data.last_name;
    if (data.username !== undefined) transformed.username = data.username;
    if (data.email !== undefined) transformed.email = data.email;
    if (data.role !== undefined) transformed.role = data.role;
    if (data.bio !== undefined) transformed.bio = data.bio;
    if (data.avatar_url !== undefined) transformed.avatarUrl = data.avatar_url;
    if (data.country !== undefined) transformed.country = data.country;
    if (data.phone_number !== undefined) transformed.phoneNumber = data.phone_number;
    if (data.timezone !== undefined) transformed.timezone = data.timezone;
    if (data.membership_tier !== undefined) transformed.membershipTier = data.membership_tier;
    if (data.social_links !== undefined) transformed.socialLinks = data.social_links;
    if (data.email_confirmed !== undefined) transformed.emailConfirmed = data.email_confirmed;
    if (data.account_status !== undefined) transformed.accountStatus = data.account_status;
    
    return transformed;
  };

  // ==================== CREATE USER ====================
  const createUser = async (userData: CreateUserData): Promise<boolean> => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc('admin_create_user' as any, {
        user_email: userData.email,
        user_password: userData.password,
        user_first_name: userData.first_name || 'User',
        user_last_name: userData.last_name || '',
        user_role: userData.role || 'user'
      }) as { data: any, error: any };
      
      if (error) {
        logger.error('RPC error creating user', { error: error.message });
        throw new Error(error.message || "Failed to create user");
      }
      
      if (!data) {
        throw new Error("User creation failed - no response");
      }
      
      toast({
        title: "User created",
        description: `User ${userData.email} created successfully`,
      });
      
      return true;
    } catch (error: any) {
      handleError(error, { component: 'useUserService', action: 'createUser' });
      toast({
        title: "Creation failed",
        description: error.message || "Failed to create user",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================== UPDATE USER ====================
  const updateUser = async (userId: string, data: UserUpdateData): Promise<boolean> => {
    setProcessingUserId(userId);
    try {
      const transformedData = transformDataForEdgeFunction(data);
      
      const { data: result, error } = await supabase.functions.invoke('get-all-users', {
        body: {
          action: 'update',
          userId,
          ...transformedData
        }
      });
      
      if (error) throw new Error(error.message || 'Failed to update user');
      if (result?.error) throw new Error(result.error);
      
      toast({
        title: "User updated",
        description: "User information has been updated successfully."
      });
      
      logger.info('User updated successfully', { userId, fields: Object.keys(data) });
      return true;
    } catch (error: any) {
      handleError(error, { component: 'useUserService', action: 'updateUser' });
      toast({
        title: "Update failed",
        description: error.message || "Failed to update user information.",
        variant: "destructive"
      });
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  // ==================== DELETE USER ====================
  const deleteUser = async (userId: string, email: string): Promise<boolean> => {
    setProcessingUserId(userId);
    try {
      logger.info('Attempting to delete user', { userId });
      
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        body: { action: 'delete', userId }
      });
      
      if (error) throw new Error(error.message || 'Failed to delete user');
      if (data && !data.success) throw new Error(data.error || 'Failed to delete user');
      
      const duration = data?.data?.transactionDuration ? ` (${Math.round(data.data.transactionDuration)}ms)` : '';
      toast({
        title: "User deleted",
        description: `User ${email} has been deleted successfully${duration}.`
      });
      
      logger.info('User deleted successfully', { userId });
      return true;
    } catch (error: any) {
      handleError(error, { component: 'useUserService', action: 'deleteUser' });
      
      let errorMessage = "Failed to delete user.";
      if (error.message?.includes("Admin access required") || error.message?.includes("UNAUTHORIZED")) {
        errorMessage = "You don't have permission to delete users.";
      } else if (error.message?.includes("User not found")) {
        errorMessage = "User not found in database.";
      } else if (error.message?.includes("foreign key") || error.message?.includes("FK_VIOLATION")) {
        errorMessage = "Cannot delete user due to existing references.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Deletion failed",
        description: errorMessage,
        variant: "destructive"
      });
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  // ==================== UPDATE USER ROLE ====================
  const updateUserRole = async (userId: string, newRole: UserRole): Promise<boolean> => {
    setProcessingUserId(userId);
    try {
      const roleValidation = validateRole(newRole);
      if (!roleValidation.isValid) {
        throw new Error(roleValidation.error);
      }
      
      // Check current role
      const { data: currentRole, error: fetchError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (fetchError) throw new Error(`Failed to verify current role: ${fetchError.message}`);
      
      // Insert if no role exists
      if (!currentRole) {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ 
            user_id: userId, 
            role: newRole,
            assigned_at: new Date().toISOString()
          });
          
        if (insertError) throw new Error(`Failed to assign role: ${insertError.message}`);
        
        toast({
          title: "Role assigned",
          description: `User has been assigned the role ${newRole}`,
        });
        return true;
      }
      
      // Update if different
      if (currentRole.role !== newRole) {
        // Delete and insert for clean transition
        await supabase.from('user_roles').delete().eq('user_id', userId);
        
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: newRole,
            assigned_at: new Date().toISOString()
          });
          
        if (insertError) throw new Error(`Failed to update role: ${insertError.message}`);
        
        toast({
          title: "Role updated",
          description: `User role has been changed to ${newRole}`,
        });
        return true;
      }
      
      toast({
        title: "No change needed",
        description: `User already has the role ${newRole}`,
      });
      return true;
    } catch (error: any) {
      handleError(error, { component: 'useUserService', action: 'updateUserRole' });
      toast({
        title: "Error updating role",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  // ==================== CONFIRM EMAIL ====================
  const confirmUserEmail = async (userId: string, userName?: string): Promise<boolean> => {
    setProcessingUserId(userId);
    try {
      const result = await callEdgeFunction("admin-bulk-confirm-users", {
        userIds: [userId],
        dryRun: false
      });

      if (result.confirmed > 0) {
        toast({
          title: "Email Confirmed",
          description: `Successfully confirmed email for ${userName || 'user'}`,
        });
        return true;
      }
      throw new Error("Failed to confirm email");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Confirmation Failed",
        description: error.message || "Failed to confirm user email",
      });
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  // ==================== SEND PASSWORD RESET ====================
  const sendPasswordResetEmail = async (email: string): Promise<boolean> => {
    setIsProcessing(true);
    try {
      // V2 release-hardening: use Supabase Auth's built-in reset flow;
      // custom `send-password-reset` is retired. Response is generic
      // to avoid disclosing account existence.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        // Log server-side only; user sees a generic success toast.
        // eslint-disable-next-line no-console
        console.warn('Password reset request rejected by Auth server');
      }

      toast({
        title: "Password reset email sent",
        description: "If an account exists for that address, a reset email has been sent."
      });
      return true;
    } catch (_error: any) {
      toast({
        title: "Password reset email sent",
        description: "If an account exists for that address, a reset email has been sent."
      });
      return true;
    } finally {
      setIsProcessing(false);
    }
  };


  // ==================== ASSIGN PLAN ====================
  const assignPlanToUser = async (userId: string, planId: string): Promise<boolean> => {
    setProcessingUserId(userId);
    try {
      // Get plan details
      const { data: planData, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();
      
      if (planError) throw planError;
      
      // Calculate end date
      let endDate = null;
      if (!planData.is_lifetime && planData.duration_days) {
        const startDate = new Date();
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + planData.duration_days);
      }
      
      // Check for existing subscription
      const { data: existingSub } = await supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      
      if (existingSub) {
        // Update existing
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            plan_id: planId,
            end_date: endDate,
            payment_method: 'admin_assigned', 
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSub.id);
        if (updateError) throw updateError;
      } else {
        // Create new
        const { error: insertError } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            plan_id: planId,
            start_date: new Date().toISOString(),
            end_date: endDate,
            status: 'active',
            payment_method: 'admin_assigned'
          });
        if (insertError) throw insertError;
      }
      
      // Record transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          plan_id: planId,
          amount_usd: planData.price_usd,
          status: 'completed'
        });
      
      toast({
        title: "Plan assigned",
        description: `Successfully assigned ${planData.name} plan to the user.`
      });
      
      return true;
    } catch (error: any) {
      handleError(error, { component: 'useUserService', action: 'assignPlan' });
      toast({
        title: "Assignment failed",
        description: error.message || "Failed to assign plan to user.",
        variant: "destructive"
      });
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  // ==================== CANCEL SUBSCRIPTION ====================
  const cancelUserSubscription = async (userId: string, userEmail: string): Promise<boolean> => {
    setProcessingUserId(userId);
    try {
      if (!session) {
        toast({
          title: "Authentication Error",
          description: "Admin authentication is required.",
          variant: "destructive",
        });
        return false;
      }
      
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { userId }
      });

      if (error || (data && !data.success)) {
        throw new Error(error?.message || data?.error || "Error cancelling subscription");
      }
      
      toast({
        title: "Subscription Cancelled",
        description: `Subscription for ${userEmail} has been cancelled.`,
      });

      return true;
    } catch (error: any) {
      handleError(error, { component: 'useUserService', action: 'cancelSubscription' });
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
      return false;
    } finally {
      setProcessingUserId(null);
    }
  };

  return {
    // State
    processingUserId,
    isProcessing,
    
    // CRUD Operations
    createUser,
    updateUser,
    deleteUser,
    
    // Role Management
    updateUserRole,
    
    // Email Operations
    confirmUserEmail,
    sendPasswordResetEmail,
    
    // Subscription Operations
    assignPlanToUser,
    cancelUserSubscription,
  };
}

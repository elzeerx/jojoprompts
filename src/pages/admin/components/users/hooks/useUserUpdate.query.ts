import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { validateRole } from "@/utils/roleValidation";
import { UserUpdateData, UserRole } from "@/types/user";

interface UserUpdateResult {
  success: boolean;
  message?: string;
  data?: any;
}

export function useUserUpdate() {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: UserUpdateData }): Promise<UserUpdateResult> => {
      // Validate role if provided
      if (data.role) {
        const roleValidation = validateRole(data.role);
        if (!roleValidation.isValid) {
          throw new Error(roleValidation.error);
        }
      }

      // Use the comprehensive edge function for all updates
      const { data: result, error } = await supabase.functions.invoke(
        "get-all-users",
        {
          body: {
            action: 'update',
            userId,
            firstName: data.first_name,
            lastName: data.last_name,
            username: data.username,
            email: data.email,
            role: data.role,
            bio: data.bio,
            avatarUrl: data.avatar_url,
            country: data.country,
            phoneNumber: data.phone_number,
            timezone: data.timezone,
            membershipTier: data.membership_tier,
            socialLinks: data.social_links,
            accountStatus: (data as any).account_status,
            emailConfirmed: (data as any).email_confirmed
          }
        }
      );

      if (error) {
        throw new Error(error.message || 'Failed to update user');
      }

      return {
        success: true,
        message: result?.message || "User updated successfully",
        data: result
      };
    },
    onMutate: async ({ userId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['admin-users'] });

      // Snapshot the previous value
      const previousUsers = queryClient.getQueriesData({ queryKey: ['admin-users'] });

      // Optimistically update for safe operations (role, name changes)
      if (data.role || data.first_name !== undefined || data.last_name !== undefined) {
        queryClient.setQueriesData({ queryKey: ['admin-users'] }, (old: any) => {
          if (!old) return old;
          
          return {
            ...old,
            users: old.users.map((user: any) => 
              user.id === userId 
                ? { 
                    ...user, 
                    ...(data.role && { role: data.role }),
                    ...(data.first_name !== undefined && { first_name: data.first_name }),
                    ...(data.last_name !== undefined && { last_name: data.last_name })
                  }
                : user
            )
          };
        });
      }

      // Return a context object with the snapshotted value
      return { previousUsers };
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic update
      if (context?.previousUsers) {
        context.previousUsers.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      console.error("Error updating user:", error);
      toast({
        title: "Update failed",
        description: error.message || "Failed to update user information.",
        variant: "destructive"
      });
    },
    onSuccess: (result, { userId }) => {
      toast({
        title: "User updated",
        description: "User information has been updated successfully."
      });

      // Invalidate and refetch users query to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  return {
    updateUser: (userId: string, data: UserUpdateData) => 
      updateMutation.mutateAsync({ userId, data }),
    processingUserId: updateMutation.isPending ? updateMutation.variables?.userId : null,
    isLoading: updateMutation.isPending,
    error: updateMutation.error?.message || null
  };
}
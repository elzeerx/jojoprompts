import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { validateRole, UserRole } from "@/utils/roleValidation";

interface UserUpdateData {
  first_name?: string | null;
  last_name?: string | null;
  role?: UserRole;
  email?: string;
}

interface UserUpdateResult {
  success: boolean;
  message?: string;
  data?: any;
}

export function useUserUpdate() {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: UserUpdateData }): Promise<UserUpdateResult> => {
      let updated = false;
      const updates: any = {};

      // Validate role if provided
      if (data.role) {
        const roleValidation = validateRole(data.role);
        if (!roleValidation.isValid) {
          throw new Error(roleValidation.error);
        }
        updates.role = data.role;
      }

      // Update user profile data
      if (data.first_name !== undefined || data.last_name !== undefined || data.role) {
        const profileUpdates: any = {};
        if (data.first_name !== undefined) profileUpdates.first_name = data.first_name;
        if (data.last_name !== undefined) profileUpdates.last_name = data.last_name;
        if (data.role) profileUpdates.role = data.role;

        const { error } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', userId);

        if (error) throw error;
        updated = true;
        Object.assign(updates, profileUpdates);
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
        updates.email = data.email;
      }

      if (!updated) {
        throw new Error("No fields to update");
      }

      return {
        success: true,
        message: "User updated successfully",
        data: { userId, updates }
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
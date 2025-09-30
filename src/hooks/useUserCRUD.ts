import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserPermissions } from "./useUserPermissions";
import { UserUpdateData, CreateUserData } from "@/types/user";

/**
 * Unified hook for all user CRUD operations
 * Simplifies user management with a single interface
 */
export function useUserCRUD() {
  const queryClient = useQueryClient();
  const permissions = useUserPermissions();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const pageSize = 10;

  // Fetch users with pagination and search
  const {
    data: usersData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['users', currentPage, pageSize, searchTerm],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        method: 'GET',
        body: null,
      });

      if (error) throw error;
      return data;
    },
    enabled: permissions.canReadUsers
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserData) => {
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        body: {
          action: 'create',
          ...userData
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create user");
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: UserUpdateData }) => {
      const { data: result, error } = await supabase.functions.invoke('get-all-users', {
        body: {
          action: 'update',
          userId,
          ...data
        }
      });

      if (error) throw error;
      return result;
    },
    onMutate: async ({ userId, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['users'] });

      // Snapshot previous value
      const previousUsers = queryClient.getQueryData(['users', currentPage, pageSize, searchTerm]);

      // Optimistically update
      queryClient.setQueryData(['users', currentPage, pageSize, searchTerm], (old: any) => {
        if (!old?.users) return old;
        return {
          ...old,
          users: old.users.map((user: any) =>
            user.id === userId ? { ...user, ...data } : user
          )
        };
      });

      return { previousUsers };
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousUsers) {
        queryClient.setQueryData(
          ['users', currentPage, pageSize, searchTerm],
          context.previousUsers
        );
      }
      toast.error(error.message || "Failed to update user");
    },
    onSuccess: () => {
      toast.success("User updated successfully");
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        body: {
          action: 'delete',
          userId
        }
      });

      if (error) throw error;
      return data;
    },
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const previousUsers = queryClient.getQueryData(['users', currentPage, pageSize, searchTerm]);

      // Optimistically remove user
      queryClient.setQueryData(['users', currentPage, pageSize, searchTerm], (old: any) => {
        if (!old?.users) return old;
        return {
          ...old,
          users: old.users.filter((user: any) => user.id !== userId),
          total: old.total - 1
        };
      });

      return { previousUsers };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(
          ['users', currentPage, pageSize, searchTerm],
          context.previousUsers
        );
      }
      toast.error(error.message || "Failed to delete user");
    },
    onSuccess: () => {
      toast.success("User deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['users'] });
    }
  });

  // Change password mutation (super admin only)
  const changePasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        body: {
          action: 'change-password',
          userId,
          newPassword
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Password changed successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to change password");
    }
  });

  return {
    // Data
    users: usersData?.users || [],
    total: usersData?.total || 0,
    totalPages: usersData?.totalPages || 0,
    currentPage,
    searchTerm,

    // State
    isLoading,
    error,
    isCreating: createUserMutation.isPending,
    isUpdating: updateUserMutation.isPending,
    isDeleting: deleteUserMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,

    // Actions
    createUser: (userData: CreateUserData) => {
      if (!permissions.canCreateUsers) {
        toast.error("You don't have permission to create users");
        return Promise.reject(new Error("Permission denied"));
      }
      return createUserMutation.mutateAsync(userData);
    },
    updateUser: (userId: string, data: UserUpdateData) => {
      if (!permissions.canUpdateUsers) {
        toast.error("You don't have permission to update users");
        return Promise.reject(new Error("Permission denied"));
      }
      return updateUserMutation.mutateAsync({ userId, data });
    },
    deleteUser: (userId: string) => {
      if (!permissions.canDeleteUsers) {
        toast.error("You don't have permission to delete users");
        return Promise.reject(new Error("Permission denied"));
      }
      return deleteUserMutation.mutateAsync(userId);
    },
    changePassword: (userId: string, newPassword: string) => {
      if (!permissions.canChangePasswords) {
        toast.error("Only super admin can change user passwords");
        return Promise.reject(new Error("Permission denied"));
      }
      return changePasswordMutation.mutateAsync({ userId, newPassword });
    },
    setPage: setCurrentPage,
    setSearch: (search: string) => {
      setSearchTerm(search);
      setCurrentPage(1);
    },
    refetch,

    // Permissions
    permissions
  };
}

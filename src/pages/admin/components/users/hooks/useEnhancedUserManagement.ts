
import { useState, useCallback } from "react";
import { useFetchUsers } from "./useFetchUsers";
import { useUserUpdate } from "./useUserUpdate";
import { usePlanAssignment } from "./usePlanAssignment";
import { usePasswordReset } from "./usePasswordReset";
import { useUserDeletion } from "./useUserDeletion";
import { useDebounce } from "@/hooks/useDebounce";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { EnhancedErrorHandler } from "@/utils/enhancedErrorHandler";
import { UserRole } from "@/utils/roleValidation";

interface UserUpdateData {
  first_name?: string | null;
  last_name?: string | null;
  role?: UserRole;
  email?: string;
}

export function useEnhancedUserManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  const pageSize = 10;
  
  // Debounce search to avoid excessive API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  const { trackActivity } = useActivityTracker();
  
  const { users, loading, error, total, totalPages, fetchUsers } = useFetchUsers({
    page: currentPage,
    limit: pageSize,
    search: debouncedSearchTerm
  });
  
  const { processingUserId: updateProcessingUserId, updateUser } = useUserUpdate();
  const { processingUserId: planProcessingUserId, assignPlanToUser } = usePlanAssignment();
  const { sendPasswordResetEmail } = usePasswordReset();
  const { processingUserId: deleteProcessingUserId, deleteUser } = useUserDeletion();

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    trackActivity('admin_action', { action: 'page_change', page });
  }, [trackActivity]);

  const handleSearchChange = useCallback((search: string) => {
    setSearchTerm(search);
    setCurrentPage(1); // Reset to first page when searching
    
    if (search) {
      trackActivity('search_query', { search_term: search, context: 'user_management' });
    }
  }, [trackActivity]);

  const handleManualRefresh = useCallback(async () => {
    try {
      setIsManualRefresh(true);
      await fetchUsers();
      trackActivity('admin_action', { action: 'manual_refresh', context: 'user_management' });
    } catch (error) {
      EnhancedErrorHandler.handle(error, {
        component: 'UserManagement',
        action: 'manual_refresh'
      });
    } finally {
      setIsManualRefresh(false);
    }
  }, [fetchUsers, trackActivity]);

  const handleUpdateUser = useCallback(async (userId: string, data: UserUpdateData) => {
    try {
      const success = await updateUser(userId, data);
      if (success) {
        await fetchUsers();
        trackActivity('admin_action', { 
          action: 'user_update', 
          target_user_id: userId,
          updated_fields: Object.keys(data)
        });
      }
      return success;
    } catch (error) {
      EnhancedErrorHandler.handle(error, {
        component: 'UserManagement',
        action: 'update_user',
        metadata: { userId, updateData: data }
      });
      return false;
    }
  }, [updateUser, fetchUsers, trackActivity]);

  const handleAssignPlanToUser = useCallback(async (userId: string, planId: string) => {
    try {
      const success = await assignPlanToUser(userId, planId);
      if (success) {
        await fetchUsers();
        trackActivity('admin_action', { 
          action: 'plan_assignment', 
          target_user_id: userId,
          plan_id: planId
        });
      }
      return success;
    } catch (error) {
      EnhancedErrorHandler.handle(error, {
        component: 'UserManagement',
        action: 'assign_plan',
        metadata: { userId, planId }
      });
      return false;
    }
  }, [assignPlanToUser, fetchUsers, trackActivity]);

  const handleDeleteUser = useCallback(async (userId: string, email: string) => {
    try {
      const success = await deleteUser(userId, email);
      if (success) {
        await fetchUsers();
        trackActivity('admin_action', { 
          action: 'user_deletion', 
          target_user_id: userId,
          target_user_email: email
        });
      }
      return success;
    } catch (error) {
      EnhancedErrorHandler.handle(error, {
        component: 'UserManagement',
        action: 'delete_user',
        metadata: { userId, email }
      });
      return false;
    }
  }, [deleteUser, fetchUsers, trackActivity]);

  // Combine processing states from different hooks
  const processingUserId = updateProcessingUserId || planProcessingUserId || deleteProcessingUserId;

  return {
    users,
    loading: loading || isManualRefresh,
    error,
    total,
    currentPage,
    totalPages,
    searchTerm,
    debouncedSearchTerm,
    isManualRefresh,
    onPageChange: handlePageChange,
    onSearchChange: handleSearchChange,
    onManualRefresh: handleManualRefresh,
    updatingUserId: processingUserId,
    fetchUsers,
    updateUser: handleUpdateUser,
    assignPlanToUser: handleAssignPlanToUser,
    sendPasswordResetEmail,
    deleteUser: handleDeleteUser
  };
}

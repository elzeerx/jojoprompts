
import { useFetchUsers } from "./useFetchUsers";
import { useUserRoleManagement } from "./useUserRoleManagement";
import { useUserActions } from "./useUserActions";
import { useCallback } from "react";

export function useUserManagement() {
  const { users, loading, error, fetchUsers } = useFetchUsers();
  const { updatingUserId, updateUserRole } = useUserRoleManagement();
  const { processingUserId, sendPasswordResetEmail, deleteUser } = useUserActions();

  // Wrap the updateRole handler with explicit refresh logic
  const handleUpdateRole = useCallback(async (userId: string, newRole: string) => {
    const success = await updateUserRole(userId, newRole);
    if (success) {
      // Force a refresh of the users data after a short delay to ensure the database has updated
      setTimeout(() => {
        fetchUsers();
      }, 300);
    }
    return success;
  }, [updateUserRole, fetchUsers]);

  // Similarly ensure deletion is followed by a data refresh
  const handleDeleteUser = useCallback(async (userId: string, email: string) => {
    const success = await deleteUser(userId, email);
    if (success) {
      fetchUsers();
    }
    return success;
  }, [deleteUser, fetchUsers]);

  return {
    users,
    loading,
    error,
    updatingUserId: updatingUserId || processingUserId,
    fetchUsers,
    updateUserRole: handleUpdateRole,
    sendPasswordResetEmail,
    deleteUser: handleDeleteUser
  };
}

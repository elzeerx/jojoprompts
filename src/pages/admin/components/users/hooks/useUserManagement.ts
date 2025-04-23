
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
    try {
      console.log(`Attempting to update role for user ${userId} to ${newRole}`);
      const success = await updateUserRole(userId, newRole);
      
      if (success) {
        console.log("Role update reported successful, scheduling data refresh");
        // Force a refresh of the users data after a delay to ensure the database has updated
        setTimeout(() => {
          console.log("Refreshing user data after role update");
          fetchUsers().catch(err => {
            console.error("Error refreshing users after role update:", err);
          });
        }, 700); // Increased delay to ensure database updates propagate
      } else {
        console.log("Role update was not successful");
      }
      return success;
    } catch (err) {
      console.error("Error in handleUpdateRole:", err);
      return false;
    }
  }, [updateUserRole, fetchUsers]);

  // Similarly ensure deletion is followed by a data refresh
  const handleDeleteUser = useCallback(async (userId: string, email: string) => {
    try {
      const success = await deleteUser(userId, email);
      if (success) {
        // Delay the fetch to ensure database updates have propagated
        setTimeout(() => {
          fetchUsers().catch(err => {
            console.error("Error refreshing users after deletion:", err);
          });
        }, 700);
      }
      return success;
    } catch (err) {
      console.error("Error in handleDeleteUser:", err);
      return false;
    }
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

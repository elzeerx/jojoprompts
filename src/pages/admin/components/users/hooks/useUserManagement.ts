
import { useFetchUsers } from "./useFetchUsers";
import { useUserRoleManagement } from "./useUserRoleManagement";
import { useUserActions } from "./useUserActions";

export function useUserManagement() {
  const { users, loading, error, fetchUsers } = useFetchUsers();
  const { updatingUserId, updateUserRole } = useUserRoleManagement();
  const { processingUserId, sendPasswordResetEmail, deleteUser } = useUserActions();

  const handleUpdateRole = async (userId: string, newRole: string) => {
    const success = await updateUserRole(userId, newRole);
    if (success) {
      fetchUsers();
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    const success = await deleteUser(userId, email);
    if (success) {
      fetchUsers();
    }
  };

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

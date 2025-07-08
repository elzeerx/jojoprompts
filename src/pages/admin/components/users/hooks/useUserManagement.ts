
import { useState } from "react";
import { useFetchUsers } from "./useFetchUsers";
import { useUserUpdate } from "./useUserUpdate";
import { usePlanAssignment } from "./usePlanAssignment";
import { usePasswordReset } from "./usePasswordReset";
import { useUserDeletion } from "./useUserDeletion";
import { UserRole } from "@/utils/roleValidation";

interface UserUpdateData {
  first_name?: string | null;
  last_name?: string | null;
  role?: UserRole;
  email?: string;
}

export function useUserManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const pageSize = 10;
  
  const { users, loading, error, total, totalPages, fetchUsers } = useFetchUsers({
    page: currentPage,
    limit: pageSize,
    search: searchTerm
  });
  
  const { processingUserId: updateProcessingUserId, updateUser } = useUserUpdate();
  const { processingUserId: planProcessingUserId, assignPlanToUser } = usePlanAssignment();
  const { sendPasswordResetEmail } = usePasswordReset();
  const { processingUserId: deleteProcessingUserId, deleteUser } = useUserDeletion();

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (search: string) => {
    setSearchTerm(search);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleUpdateUser = async (userId: string, data: UserUpdateData) => {
    const success = await updateUser(userId, data);
    if (success) {
      fetchUsers();
    }
  };

  const handleAssignPlanToUser = async (userId: string, planId: string) => {
    const success = await assignPlanToUser(userId, planId);
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

  // Combine processing states from different hooks
  const processingUserId = updateProcessingUserId || planProcessingUserId || deleteProcessingUserId;

  return {
    users,
    loading,
    error,
    total,
    currentPage,
    totalPages,
    searchTerm,
    onPageChange: handlePageChange,
    onSearchChange: handleSearchChange,
    updatingUserId: processingUserId,
    fetchUsers,
    updateUser: handleUpdateUser,
    assignPlanToUser: handleAssignPlanToUser,
    sendPasswordResetEmail,
    deleteUser: handleDeleteUser
  };
}

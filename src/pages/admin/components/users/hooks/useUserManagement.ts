
import { useState } from "react";
import { useFetchUsers } from "./useFetchUsers.query";
import { useUserUpdate } from "./useUserUpdate.query";
import { usePlanAssignment } from "./usePlanAssignment.query";
import { usePasswordReset } from "./usePasswordReset";
import { useUserDeletion } from "./useUserDeletion.query";
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
  
  const { users, loading, error, total, totalPages, refetch, retryCount, performance } = useFetchUsers({
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
    try {
      await updateUser(userId, data);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleAssignPlanToUser = async (userId: string, planId: string) => {
    try {
      await assignPlanToUser(userId, planId);
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    try {
      await deleteUser(userId, email);
      return true;
    } catch (error) {
      return false;
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
    refetch: refetch,
    updateUser: handleUpdateUser,
    assignPlanToUser: handleAssignPlanToUser,
    sendPasswordResetEmail,
    deleteUser: handleDeleteUser,
    retryCount,
    performance
  };
}

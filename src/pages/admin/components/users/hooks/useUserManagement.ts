
import { useState } from "react";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useUserUpdate } from "./useUserUpdate.query";
import { usePlanAssignment } from "./usePlanAssignment.query";
import { usePasswordReset } from "./usePasswordReset";
import { UserUpdateData, UserRole } from "@/types/user";

export function useUserManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const pageSize = 10;
  
  // Use direct database queries instead of edge function
  const { 
    users, 
    loading, 
    error, 
    total, 
    totalPages, 
    refetch, 
    deleteUser: deleteUserFn,
    isDeleting 
  } = useAdminUsers(currentPage, pageSize, searchTerm);
  
  const { processingUserId: updateProcessingUserId, updateUser } = useUserUpdate();
  const { processingUserId: planProcessingUserId, assignPlanToUser } = usePlanAssignment();
  const { sendPasswordResetEmail } = usePasswordReset();

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

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      deleteUserFn(userId);
      return true;
    }
    return false;
  };

  // Combine processing states from different hooks
  const processingUserId = updateProcessingUserId || planProcessingUserId || (isDeleting ? 'deleting' : null);

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
    DeleteDialog: null, // No longer using dialog
    performance: undefined // No performance metrics without edge function
  };
}

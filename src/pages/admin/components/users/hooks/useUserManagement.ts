
import { useState } from "react";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useUserUpdate } from "./useUserUpdate";
import { usePlanAssignment } from "./usePlanAssignment";
import { usePasswordReset } from "./usePasswordReset";
import { useUserDeletion } from "./useUserDeletion";
import { UserUpdateData, UserRole } from "@/types/user";

export function useUserManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const pageSize = 10;
  
  // Use unified view-based hook
  const { 
    users: allUsers,
    loading,
    error,
    refetch
  } = useAdminUsers();
  
  // Client-side filtering and pagination
  const filteredUsers = searchTerm 
    ? allUsers.filter(user => 
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : allUsers;
  
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const users = filteredUsers.slice(startIndex, endIndex);
  
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

  const { processingUserId: deletionProcessingUserId, deleteUser: performDelete } = useUserDeletion();

  const handleDeleteUser = async (userId: string, email: string, firstName: string, lastName: string, role: string) => {
    const success = await performDelete(userId, email);
    if (success) {
      await refetch(); // Refresh user list after successful deletion
    }
    return success;
  };

  const processingUserId = updateProcessingUserId || planProcessingUserId || deletionProcessingUserId || null;

  return {
    users,
    loading,
    error: error || null,
    total: filteredUsers.length,
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
    DeleteDialog: null,
    performance: undefined
  };
}

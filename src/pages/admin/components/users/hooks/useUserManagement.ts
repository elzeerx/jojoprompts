import { useState } from "react";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useUserUpdate } from "./useUserUpdate";
import { usePlanAssignment } from "./usePlanAssignment";
import { usePasswordReset } from "./usePasswordReset";
import { useUserDeletion } from "./useUserDeletion";
import { useEmailConfirmation } from "./useEmailConfirmation";
import { UserUpdateData, UserRole } from "@/types/user";

export function useUserManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [accountStatusFilter, setAccountStatusFilter] = useState("all");
  const pageSize = 10;
  
  // Use unified view-based hook
  const { 
    users: allUsers,
    loading,
    error,
    refetch
  } = useAdminUsers();
  
  // Client-side filtering and pagination
  const filteredUsers = allUsers.filter(user => {
    // Search filter
    const matchesSearch = !searchTerm || 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Tier filter - subscription is nested object
    const planName = user.subscription?.plan_name?.toLowerCase() || '';
    const matchesTier = tierFilter === 'all' || 
      (tierFilter === 'free' && !user.subscription?.plan_name) ||
      planName.includes(tierFilter.toLowerCase());
    
    // Verification filter
    const matchesVerification = verificationFilter === 'all' ||
      (verificationFilter === 'verified' && user.is_email_confirmed) ||
      (verificationFilter === 'unverified' && !user.is_email_confirmed);
    
    // Account status filter (orphaned profiles)
    const matchesAccountStatus = accountStatusFilter === 'all' ||
      (accountStatusFilter === 'active' && user.has_auth_account === true) ||
      (accountStatusFilter === 'orphaned' && user.has_auth_account === false);
    
    return matchesSearch && matchesTier && matchesVerification && matchesAccountStatus;
  });
  
  // Calculate orphaned count
  const orphanedCount = allUsers.filter(u => u.has_auth_account === false).length;
  
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const users = filteredUsers.slice(startIndex, endIndex);
  
  const { processingUserId: updateProcessingUserId, updateUser } = useUserUpdate();
  const { processingUserId: planProcessingUserId, assignPlanToUser } = usePlanAssignment();
  const { sendPasswordResetEmail } = usePasswordReset();
  const { confirmUserEmail, bulkConfirmUsers, processingUserId: confirmProcessingUserId, bulkProcessing } = useEmailConfirmation();

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (search: string) => {
    setSearchTerm(search);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleTierFilterChange = (tier: string) => {
    setTierFilter(tier);
    setCurrentPage(1);
  };

  const handleVerificationFilterChange = (verification: string) => {
    setVerificationFilter(verification);
    setCurrentPage(1);
  };

  const handleAccountStatusFilterChange = (status: string) => {
    setAccountStatusFilter(status);
    setCurrentPage(1);
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

  const processingUserId = updateProcessingUserId || planProcessingUserId || deletionProcessingUserId || confirmProcessingUserId || null;

  return {
    users,
    loading,
    error: error || null,
    total: filteredUsers.length,
    currentPage,
    totalPages,
    searchTerm,
    tierFilter,
    verificationFilter,
    accountStatusFilter,
    orphanedCount,
    onPageChange: handlePageChange,
    onSearchChange: handleSearchChange,
    onTierFilterChange: handleTierFilterChange,
    onVerificationFilterChange: handleVerificationFilterChange,
    onAccountStatusFilterChange: handleAccountStatusFilterChange,
    updatingUserId: processingUserId,
    refetch: refetch,
    updateUser: handleUpdateUser,
    assignPlanToUser: handleAssignPlanToUser,
    sendPasswordResetEmail,
    deleteUser: handleDeleteUser,
    confirmUserEmail,
    bulkConfirmUsers,
    bulkProcessing,
    DeleteDialog: null,
    performance: undefined
  };
}

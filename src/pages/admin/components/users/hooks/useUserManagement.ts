import { useUserService } from "./useUserService";
import { useUserList, UserFilters } from "./useUserList";
import { useUserBulkActions } from "./useUserBulkActions";
import { UserUpdateData } from "@/types/user";

/**
 * Main hook that combines all user management functionality
 * Uses consolidated hooks: useUserService, useUserList, useUserBulkActions
 */
export function useUserManagement() {
  // List management (fetching, filtering, pagination)
  const {
    users,
    allUsers,
    filteredUsers,
    loading,
    error,
    stats,
    currentPage,
    totalPages,
    total,
    searchTerm,
    filters,
    setPage,
    setSearch,
    setFilter,
    resetFilters,
    refetch
  } = useUserList({ pageSize: 10 });

  // CRUD operations
  const {
    processingUserId,
    isProcessing,
    createUser,
    updateUser,
    deleteUser,
    updateUserRole,
    confirmUserEmail,
    sendPasswordResetEmail,
    assignPlanToUser,
    cancelUserSubscription
  } = useUserService();

  // Bulk operations
  const {
    isProcessing: bulkProcessing,
    selectedUserIds,
    bulkConfirmUsers,
    exportUsers,
    toggleUserSelection,
    selectAllUsers,
    clearSelection
  } = useUserBulkActions();

  // Handler wrappers (for backward compatibility)
  const handleUpdateUser = async (userId: string, data: UserUpdateData) => {
    const success = await updateUser(userId, data);
    if (success) await refetch();
    return success;
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    const success = await deleteUser(userId, email);
    if (success) await refetch();
    return success;
  };

  const handleAssignPlanToUser = async (userId: string, planId: string) => {
    const success = await assignPlanToUser(userId, planId);
    if (success) await refetch();
    return success;
  };

  const handleConfirmUserEmail = async (userId: string, userName?: string) => {
    const success = await confirmUserEmail(userId, userName);
    if (success) await refetch();
    return success;
  };

  return {
    // Data
    users,
    allUsers,
    filteredUsers,
    
    // Loading states
    loading,
    error,
    
    // Stats
    stats,
    total,
    orphanedCount: stats.orphaned,
    
    // Pagination
    currentPage,
    totalPages,
    
    // Search & Filters
    searchTerm,
    tierFilter: filters.tier,
    verificationFilter: filters.verification,
    accountStatusFilter: filters.accountStatus,
    roleFilter: filters.role,
    
    // Filter handlers (backward compatible names)
    onPageChange: setPage,
    onSearchChange: setSearch,
    onTierFilterChange: (value: string) => setFilter('tier', value),
    onVerificationFilterChange: (value: string) => setFilter('verification', value),
    onAccountStatusFilterChange: (value: string) => setFilter('accountStatus', value),
    onRoleFilterChange: (value: string) => setFilter('role', value),
    resetFilters,
    
    // Processing state
    updatingUserId: processingUserId,
    isProcessing,
    
    // CRUD Operations
    createUser,
    updateUser: handleUpdateUser,
    deleteUser: handleDeleteUser,
    updateUserRole,
    
    // Email Operations
    confirmUserEmail: handleConfirmUserEmail,
    sendPasswordResetEmail,
    
    // Subscription Operations
    assignPlanToUser: handleAssignPlanToUser,
    cancelUserSubscription,
    
    // Bulk Operations
    bulkProcessing,
    selectedUserIds,
    bulkConfirmUsers,
    exportUsers,
    toggleUserSelection,
    selectAllUsers,
    clearSelection,
    
    // Refresh
    refetch,
    
    // Deprecated (for backward compatibility)
    DeleteDialog: null,
    performance: undefined
  };
}

// Re-export types and hooks for direct usage
export type { UserFilters };
export { useUserService } from "./useUserService";
export { useUserList } from "./useUserList";
export { useUserBulkActions } from "./useUserBulkActions";

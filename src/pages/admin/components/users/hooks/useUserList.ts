import { useState, useMemo, useCallback } from "react";
import { useAdminUsers, AdminUser } from "@/hooks/useAdminUsers";

export interface UserFilters {
  tier: string;
  verification: string;
  accountStatus: string;
  role: string;
}

interface UseUserListOptions {
  pageSize?: number;
}

/**
 * Consolidated hook for user list fetching, filtering, and pagination
 * Replaces filtering/pagination logic from useUserManagement
 */
export function useUserList(options: UseUserListOptions = {}) {
  const { pageSize = 10 } = options;
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter state
  const [filters, setFilters] = useState<UserFilters>({
    tier: "all",
    verification: "all",
    accountStatus: "all",
    role: "all"
  });
  
  // Fetch all users
  const { 
    users: allUsers,
    loading,
    error,
    refetch
  } = useAdminUsers();
  
  // Memoized filtered users
  const filteredUsers = useMemo(() => {
    return allUsers.filter(user => {
      // Search filter
      const matchesSearch = !searchTerm || 
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Tier filter
      const planName = user.subscription?.plan_name?.toLowerCase() || '';
      const matchesTier = filters.tier === 'all' || 
        (filters.tier === 'free' && !user.subscription?.plan_name) ||
        planName.includes(filters.tier.toLowerCase());
      
      // Verification filter
      const matchesVerification = filters.verification === 'all' ||
        (filters.verification === 'verified' && user.is_email_confirmed) ||
        (filters.verification === 'unverified' && !user.is_email_confirmed);
      
      // Account status filter
      const matchesAccountStatus = filters.accountStatus === 'all' ||
        (filters.accountStatus === 'active' && user.has_auth_account === true) ||
        (filters.accountStatus === 'orphaned' && user.has_auth_account === false);
      
      // Role filter
      const matchesRole = filters.role === 'all' ||
        user.role === filters.role;
      
      return matchesSearch && matchesTier && matchesVerification && matchesAccountStatus && matchesRole;
    });
  }, [allUsers, searchTerm, filters]);
  
  // Memoized stats
  const stats = useMemo(() => ({
    total: allUsers.length,
    filtered: filteredUsers.length,
    orphaned: allUsers.filter(u => u.has_auth_account === false).length,
    unverified: allUsers.filter(u => !u.is_email_confirmed).length,
    admins: allUsers.filter(u => u.role === 'admin' || u.role === 'jadmin').length,
    withSubscription: allUsers.filter(u => u.subscription?.plan_name).length
  }), [allUsers, filteredUsers.length]);
  
  // Pagination calculations
  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
  
  // Handlers
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);
  
  const handleSearchChange = useCallback((search: string) => {
    setSearchTerm(search);
    setCurrentPage(1);
  }, []);
  
  const handleFilterChange = useCallback((key: keyof UserFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);
  
  const resetFilters = useCallback(() => {
    setFilters({
      tier: "all",
      verification: "all",
      accountStatus: "all",
      role: "all"
    });
    setSearchTerm("");
    setCurrentPage(1);
  }, []);

  return {
    // Data
    users: paginatedUsers,
    allUsers,
    filteredUsers,
    
    // Loading state
    loading,
    error,
    
    // Stats
    stats,
    
    // Pagination
    currentPage,
    totalPages,
    pageSize,
    total: filteredUsers.length,
    
    // Search
    searchTerm,
    
    // Filters
    filters,
    
    // Handlers
    setPage: handlePageChange,
    setSearch: handleSearchChange,
    setFilter: handleFilterChange,
    resetFilters,
    
    // Refetch
    refetch
  };
}

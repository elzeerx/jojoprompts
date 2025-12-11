import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { callEdgeFunction } from "@/utils/edgeFunctions";
import { createLogger } from '@/utils/logging';
import { ExtendedUserProfile } from "@/types/user";

const logger = createLogger('USER_BULK_ACTIONS');

interface BulkConfirmResult {
  totalUsers: number;
  confirmed: number;
  processed: number;
  errors: string[];
}

/**
 * Consolidated hook for bulk user operations
 * Includes: email confirmation, export, role change, bulk delete
 */
export function useUserBulkActions() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // ==================== BULK EMAIL CONFIRMATION ====================
  const bulkConfirmUsers = async (
    startDateOrOptions?: string | {
      userIds?: string[];
      startDate?: string;
      endDate?: string;
      onlyWithActiveSubscriptions?: boolean;
      dryRun?: boolean;
    },
    endDate?: string,
    onlyWithActiveSubscriptions = false,
    dryRun = true
  ): Promise<BulkConfirmResult | null> => {
    let options: {
      userIds?: string[];
      startDate?: string;
      endDate?: string;
      onlyWithActiveSubscriptions?: boolean;
      dryRun?: boolean;
    };
    
    if (typeof startDateOrOptions === 'object') {
      options = startDateOrOptions;
    } else {
      options = {
        startDate: startDateOrOptions,
        endDate,
        onlyWithActiveSubscriptions,
        dryRun
      };
    }
    
    const isDryRun = options.dryRun ?? true;
    setIsProcessing(true);
    
    try {
      const result = await callEdgeFunction("admin-bulk-confirm-users", {
        userIds: options.userIds,
        startDate: options.startDate,
        endDate: options.endDate,
        onlyWithActiveSubscriptions: options.onlyWithActiveSubscriptions,
        dryRun: isDryRun
      });

      if (isDryRun) {
        toast({
          title: "Dry Run Complete",
          description: `Would confirm ${result.totalUsers || 0} users`,
        });
      } else {
        toast({
          title: "Bulk Confirmation Complete",
          description: `Confirmed ${result.confirmed || 0} out of ${result.processed || 0} users`,
        });
      }

      logger.info('Bulk confirm completed', { dryRun: isDryRun, result });
      return result;
    } catch (error: any) {
      logger.error('Bulk confirm failed', { error: error.message });
      toast({
        variant: "destructive",
        title: "Bulk Confirmation Failed",
        description: error.message || "Failed to confirm users",
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================== BULK EXPORT ====================
  const exportUsers = async (
    users: Array<{
      id: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      username?: string;
      role?: string;
      created_at?: string;
      subscription?: { plan_name?: string; status?: string } | null;
    }>,
    format: 'csv' | 'json' = 'csv'
  ): Promise<boolean> => {
    setIsProcessing(true);
    
    try {
      if (format === 'csv') {
        const headers = ['ID', 'Email', 'First Name', 'Last Name', 'Username', 'Role', 'Plan', 'Status', 'Created'];
        const rows = users.map(u => [
          u.id,
          u.email || '',
          u.first_name || '',
          u.last_name || '',
          u.username || '',
          u.role || 'user',
          u.subscription?.plan_name || 'Free',
          u.subscription?.status || 'N/A',
          u.created_at ? new Date(u.created_at).toLocaleDateString() : ''
        ]);
        
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const jsonContent = JSON.stringify(users, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `users_export_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }
      
      toast({
        title: "Export Complete",
        description: `Exported ${users.length} users to ${format.toUpperCase()}`,
      });
      
      logger.info('Users exported', { count: users.length, format });
      return true;
    } catch (error: any) {
      logger.error('Export failed', { error: error.message });
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: error.message || "Failed to export users",
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================== BULK ROLE CHANGE ====================
  const bulkChangeRole = async (userIds: string[], newRole: string): Promise<boolean> => {
    if (userIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No users selected",
        description: "Please select users to change role",
      });
      return false;
    }

    setIsProcessing(true);
    
    try {
      const result = await callEdgeFunction("get-all-users", {
        action: 'bulk_role_change',
        userIds,
        newRole
      });

      if (result.success) {
        toast({
          title: "Role Change Complete",
          description: `Changed role to ${newRole} for ${result.updated || userIds.length} users`,
        });
        logger.info('Bulk role change completed', { count: userIds.length, newRole });
        return true;
      } else {
        throw new Error(result.error || 'Failed to change roles');
      }
    } catch (error: any) {
      logger.error('Bulk role change failed', { error: error.message });
      toast({
        variant: "destructive",
        title: "Role Change Failed",
        description: error.message || "Failed to change user roles",
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================== BULK DELETE ====================
  const bulkDeleteUsers = async (userIds: string[]): Promise<boolean> => {
    if (userIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No users selected",
        description: "Please select users to delete",
      });
      return false;
    }

    setIsProcessing(true);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      // Delete users one by one (safer approach)
      for (const userId of userIds) {
        try {
          const result = await callEdgeFunction("get-all-users", {
            action: 'delete',
            targetUserId: userId
          });
          
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast({
          title: "Bulk Delete Complete",
          description: `Deleted ${successCount} users${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
        });
        logger.info('Bulk delete completed', { successCount, errorCount });
        return true;
      } else {
        throw new Error('Failed to delete any users');
      }
    } catch (error: any) {
      logger.error('Bulk delete failed', { error: error.message });
      toast({
        variant: "destructive",
        title: "Bulk Delete Failed",
        description: error.message || "Failed to delete users",
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================== SELECTION MANAGEMENT ====================
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = (userIds: string[]) => {
    setSelectedUserIds(userIds);
  };

  const clearSelection = () => {
    setSelectedUserIds([]);
  };

  return {
    // State
    isProcessing,
    selectedUserIds,
    
    // Bulk Operations
    bulkConfirmUsers,
    exportUsers,
    bulkChangeRole,
    bulkDeleteUsers,
    
    // Selection Management
    toggleUserSelection,
    selectAllUsers,
    clearSelection,
  };
}

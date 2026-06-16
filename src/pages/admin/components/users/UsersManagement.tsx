import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserManagement } from "./hooks/useUserManagement";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useUserActions } from "./hooks/useUserActions";
import { useUserBulkActions } from "./hooks/useUserBulkActions";
import { UsersTable } from "./UsersTable";
import { UsersHeader } from "./components/UsersHeader";
import { UsersFilters } from "./components/UsersFilters";
import { UserPerformanceStats } from "./UserPerformanceStats";
// Marketing panel moved to /admin/emails/marketing in Phase 2.
import { UserActivityLog } from "./components/UserActivityLog";
import { QuickActionsPanel } from "./components/QuickActionsPanel";
import { BulkActionsBar } from "./components/BulkActionsBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateUserDialog } from "./components/CreateUserDialog";

export default function UsersManagement() {
  const { isSuperAdmin } = useSuperAdmin();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  const {
    users,
    total,
    totalPages,
    currentPage,
    searchTerm,
    tierFilter,
    verificationFilter,
    accountStatusFilter,
    orphanedCount,
    loading: isLoading,
    error,
    updateUser,
    deleteUser,
    confirmUserEmail,
    bulkConfirmUsers,
    bulkProcessing,
    onPageChange: setPage,
    onSearchChange: setSearch,
    onTierFilterChange,
    onVerificationFilterChange,
    onAccountStatusFilterChange,
    refetch,
    sendPasswordResetEmail,
    assignPlanToUser,
    cancelUserSubscription,
  } = useUserManagement();
  
  const { resendConfirmationEmail, resendPaymentEmail } = useUserActions();
  
  const {
    selectedUserIds,
    isProcessing,
    exportUsers,
    bulkChangeRole,
    bulkDeleteUsers,
    toggleUserSelection,
    selectAllUsers,
    clearSelection,
  } = useUserBulkActions();

  // Get selected user objects
  const selectedUsers = users.filter(u => selectedUserIds.includes(u.id));

  // Handlers for bulk actions
  const handleBulkExport = async (format: 'csv' | 'json') => {
    return await exportUsers(selectedUsers, format);
  };

  const handleBulkRoleChange = async (userIds: string[], newRole: string) => {
    const success = await bulkChangeRole(userIds, newRole);
    if (success) refetch();
    return success;
  };

  const handleBulkDelete = async (userIds: string[]) => {
    const success = await bulkDeleteUsers(userIds);
    if (success) refetch();
    return success;
  };

  const handleBulkConfirmEmails = async (userIds: string[]) => {
    const result = await bulkConfirmUsers({ userIds, dryRun: false });
    if (result) refetch();
    return result;
  };

  const handleExportAll = async () => {
    await exportUsers(users, 'csv');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Users Management</h2>
          <p className="text-muted-foreground">
            Manage user accounts, roles, subscriptions, and marketing campaigns
          </p>
        </div>
        <QuickActionsPanel
          onCreateUser={() => setCreateDialogOpen(true)}
          onExportAll={handleExportAll}
          onRefresh={refetch}
          isLoading={isLoading}
        />
      </div>

      <div className="space-y-6">
        {isSuperAdmin && (
          <Alert className="border-warm-gold bg-warm-gold/5">
            <AlertCircle className="h-4 w-4 text-warm-gold" />
            <AlertDescription>
              Super Admin Mode Active - You have complete control over all user operations
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-[360px]">
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6 mt-6">
            <UsersHeader 
              searchTerm={searchTerm}
              onSearchChange={setSearch}
              onUserCreated={refetch}
            />

            <UsersFilters
              tierFilter={tierFilter}
              onTierFilterChange={onTierFilterChange}
              verificationFilter={verificationFilter}
              onVerificationFilterChange={onVerificationFilterChange}
              accountStatusFilter={accountStatusFilter}
              onAccountStatusFilterChange={onAccountStatusFilterChange}
            />

            <UserPerformanceStats 
              total={total}
              performance={null}
              retryCount={0}
              loading={isLoading}
              orphanedCount={orphanedCount}
            />

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Failed to load users</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                    className="ml-4"
                  >
                    Try Again
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <UsersTable
                  users={users}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  total={total}
                  onPageChange={setPage}
                  updatingUserId={null}
                  onUpdateUser={updateUser}
                  onAssignPlan={assignPlanToUser}
                  onSendResetEmail={sendPasswordResetEmail}
                  onSearchChange={setSearch}
                  searchTerm={searchTerm}
                  onDeleteUser={deleteUser}
                  onResendConfirmation={resendConfirmationEmail}
                  onResendPaymentEmail={resendPaymentEmail}
                  onConfirmEmail={confirmUserEmail}
                  onBulkConfirmUsers={bulkConfirmUsers}
                  bulkProcessing={bulkProcessing}
                  onRefresh={refetch}
                  onCancelSubscription={cancelUserSubscription}
                />
                <div className="text-sm text-muted-foreground">
                  Total users: {total}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <UserActivityLog />
          </TabsContent>
        </Tabs>
      </div>

      {/* Bulk Actions Floating Bar */}
      <BulkActionsBar
        selectedCount={selectedUserIds.length}
        selectedUsers={selectedUsers}
        onClearSelection={clearSelection}
        onBulkExport={handleBulkExport}
        onBulkRoleChange={handleBulkRoleChange}
        onBulkDelete={handleBulkDelete}
        onBulkConfirmEmails={handleBulkConfirmEmails}
        isProcessing={isProcessing || bulkProcessing}
      />

      {/* Create User Dialog */}
      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onUserCreated={refetch}
      />
    </div>
  );
}

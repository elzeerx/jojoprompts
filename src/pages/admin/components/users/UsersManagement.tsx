
import { Loader2 } from "lucide-react";
import { useUserManagement } from "./hooks/useUserManagement";
import { useUserActions } from "./hooks/useUserActions";
import { UsersHeader } from "./components/UsersHeader";
import { UsersTable } from "./UsersTable";
import { UserPerformanceStats } from "./UserPerformanceStats";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function UsersManagement() {
  const {
    users,
    loading,
    error,
    total,
    currentPage,
    totalPages,
    searchTerm,
    onPageChange,
    onSearchChange,
    updatingUserId,
    fetchUsers,
    updateUser,
    assignPlanToUser,
    sendPasswordResetEmail,
    deleteUser,
    retryCount,
    performance
  } = useUserManagement();

  const { resendConfirmationEmail } = useUserActions();

  return (
    <div className="space-y-6">
      <UsersHeader 
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        onUserCreated={fetchUsers}
      />

      <UserPerformanceStats 
        performance={performance}
        retryCount={retryCount}
        total={total}
        loading={loading}
      />

      {error && (
        <Alert variant="destructive" className="mb-6 border-red-400/30 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchUsers}
              className="w-fit flex items-center gap-2 border-warm-gold/30 text-warm-gold hover:bg-warm-gold/10"
            >
              <RefreshCw className="h-4 w-4" />
              Retry {retryCount > 0 && `(${retryCount} attempts)`}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-warm-gold" />
          <div className="ml-3 text-sm text-muted-foreground">
            Loading users...
            {retryCount > 0 && ` (Attempt ${retryCount + 1})`}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-warm-gold/20 overflow-visible bg-white/80 shadow-sm">
          <UsersTable 
            users={users}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            updatingUserId={updatingUserId}
            onUpdateUser={updateUser}
            onAssignPlan={assignPlanToUser}
            onSendResetEmail={sendPasswordResetEmail}
            onDeleteUser={deleteUser}
            onResendConfirmation={resendConfirmationEmail}
            onRefresh={fetchUsers}
          />
          
          {/* Show total count info with performance data */}
          {total > 0 && (
            <div className="px-4 py-3 border-t border-warm-gold/20 bg-gray-50/50 text-sm text-muted-foreground">
              Showing {users.length} of {total} users total
              {performance && (
                <span className="ml-4 text-xs">
                  • {performance.cacheHit ? 'Cached' : 'Fresh'} data
                  • {performance.totalDuration}ms response
                  {performance.searchActive && ' • Search active'}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

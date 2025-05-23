
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useUserManagement } from "./hooks/useUserManagement";
import { UsersHeader } from "./components/UsersHeader";
import { UsersError } from "./components/UsersError";
import { UsersTable } from "./UsersTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function UsersManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const {
    users,
    loading,
    error,
    currentPage,
    totalPages,
    onPageChange,
    updatingUserId,
    fetchUsers,
    updateUser,
    assignPlanToUser,
    sendPasswordResetEmail,
    deleteUser
  } = useUserManagement();

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      user.role.toLowerCase().includes(searchLower) ||
      (user.first_name && user.first_name.toLowerCase().includes(searchLower)) ||
      (user.last_name && user.last_name.toLowerCase().includes(searchLower)) ||
      (user.subscription?.plan_name && user.subscription.plan_name.toLowerCase().includes(searchLower))
    );
  });

  return (
    <div className="space-y-6">
      <UsersHeader 
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onUserCreated={fetchUsers}
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
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-warm-gold" />
        </div>
      ) : (
        <div className="rounded-md border border-warm-gold/20 overflow-visible bg-white/80 shadow-sm">
          <UsersTable 
            users={filteredUsers}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            updatingUserId={updatingUserId}
            onUpdateUser={updateUser}
            onAssignPlan={assignPlanToUser}
            onSendResetEmail={sendPasswordResetEmail}
            onDeleteUser={deleteUser}
          />
        </div>
      )}
    </div>
  );
}

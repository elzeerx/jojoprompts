
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useUserManagement } from "./hooks/useUserManagement";
import { UsersHeader } from "./components/UsersHeader";
import { UsersError } from "./components/UsersError";
import { UsersTable } from "./UsersTable";

export default function UsersManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const {
    users,
    loading,
    error,
    updatingUserId,
    fetchUsers,
    updateUserRole,
    sendPasswordResetEmail,
    deleteUser
  } = useUserManagement();

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <UsersHeader 
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onUserCreated={fetchUsers}
      />

      {error && (
        <UsersError error={error} onRetry={fetchUsers} />
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border">
          <UsersTable 
            users={filteredUsers}
            updatingUserId={updatingUserId}
            onUpdateRole={updateUserRole}
            onSendResetEmail={sendPasswordResetEmail}
            onDeleteUser={deleteUser}
          />
        </div>
      )}
    </div>
  );
}

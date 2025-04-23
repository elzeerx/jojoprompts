
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserTableRow } from "./components/UserTableRow";
import { EmptyTableState } from "./components/EmptyTableState";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  role: string;
  last_sign_in_at: string | null;
}

interface UsersTableProps {
  users: UserProfile[];
  updatingUserId: string | null;
  onUpdateRole: (userId: string, newRole: string) => void;
  onSendResetEmail: (email: string) => void;
  onDeleteUser: (userId: string, email: string) => void;
}

export function UsersTable({
  users,
  updatingUserId,
  onUpdateRole,
  onSendResetEmail,
  onDeleteUser,
}: UsersTableProps) {
  if (users.length === 0) {
    return <EmptyTableState />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead>Last Login</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <UserTableRow
            key={user.id}
            user={user}
            isUpdating={updatingUserId === user.id}
            onUpdateRole={onUpdateRole}
            onSendResetEmail={onSendResetEmail}
            onDeleteUser={onDeleteUser}
          />
        ))}
      </TableBody>
    </Table>
  );
}

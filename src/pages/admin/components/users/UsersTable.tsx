
import { Loader2, UserCheck, UserX, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
}

export function UsersTable({
  users,
  updatingUserId,
  onUpdateRole,
  onSendResetEmail,
}: UsersTableProps) {
  if (users.length === 0) {
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
          <TableRow>
            <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
              No users found
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
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
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.email}</TableCell>
            <TableCell>
              <Select
                defaultValue={user.role}
                onValueChange={(value) => onUpdateRole(user.id, value)}
                disabled={updatingUserId === user.id}
              >
                <SelectTrigger className="w-[110px]">
                  <SelectValue>
                    <div className="flex items-center">
                      {updatingUserId === user.id ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : user.role === "admin" ? (
                        <UserCheck className="mr-2 h-3 w-3 text-primary" />
                      ) : (
                        <UserX className="mr-2 h-3 w-3 text-muted-foreground" />
                      )}
                      {user.role}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center">
                      <UserCheck className="mr-2 h-4 w-4 text-primary" />
                      admin
                    </div>
                  </SelectItem>
                  <SelectItem value="user">
                    <div className="flex items-center">
                      <UserX className="mr-2 h-4 w-4 text-muted-foreground" />
                      user
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              {new Date(user.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell>
              {user.last_sign_in_at 
                ? new Date(user.last_sign_in_at).toLocaleDateString() 
                : "Never"}
            </TableCell>
            <TableCell className="text-right">
              {user.email && !user.email.startsWith("User ") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSendResetEmail(user.email)}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Reset
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

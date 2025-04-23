
import { Loader2, UserCheck, UserX, Mail, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserTableRowProps {
  user: {
    id: string;
    email: string;
    created_at: string;
    role: string;
    last_sign_in_at: string | null;
  };
  isUpdating: boolean;
  onUpdateRole: (userId: string, newRole: string) => void;
  onSendResetEmail: (email: string) => void;
  onDeleteUser: (userId: string, email: string) => void;
}

export function UserTableRow({
  user,
  isUpdating,
  onUpdateRole,
  onSendResetEmail,
  onDeleteUser,
}: UserTableRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">{user.email}</TableCell>
      <TableCell>
        <Select
          defaultValue={user.role}
          onValueChange={(value) => onUpdateRole(user.id, value)}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-[110px]">
            <SelectValue>
              <div className="flex items-center">
                {isUpdating ? (
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
      <TableCell className="text-right flex gap-2 justify-end">
        {user.email && !user.email.startsWith("User ") && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSendResetEmail(user.email)}
            >
              <Mail className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="hover:bg-red-700"
              onClick={() => onDeleteUser(user.id, user.email)}
              title="Delete User"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </>
        )}
      </TableCell>
    </TableRow>
  );
}

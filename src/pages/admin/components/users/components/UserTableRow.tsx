
import { Loader2, UserCheck, UserX, Mail, Trash, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { UserProfile } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditUserDialog } from "./EditUserDialog";
import { useState } from "react";

interface UserTableRowProps {
  user: UserProfile;
  isUpdating: boolean;
  onUpdateUser: (userId: string, data: Partial<UserProfile>) => void;
  onSendResetEmail: (email: string) => void;
  onDeleteUser: (userId: string, email: string) => void;
}

export function UserTableRow({
  user,
  isUpdating,
  onUpdateUser,
  onSendResetEmail,
  onDeleteUser,
}: UserTableRowProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleDeleteClick = () => {
    if (window.confirm(`Are you sure you want to delete user ${user.email}?`)) {
      onDeleteUser(user.id, user.email);
    }
  };

  // Format user's name for display
  const displayName = user.first_name || user.last_name 
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
    : <span className="text-muted-foreground italic">Not set</span>;

  // Add console logging to debug the name display issue
  console.log("User data in UserTableRow:", {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    displayName
  });

  return (
    <TableRow>
      <TableCell>
        {typeof displayName === 'string' ? displayName : displayName}
      </TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>
        <Select
          defaultValue={user.role}
          onValueChange={(value) => onUpdateUser(user.id, { role: value })}
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
      <TableCell className="text-right">
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
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
            size="sm"
            onClick={handleDeleteClick}
            className="hover:bg-red-700"
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
      <EditUserDialog
        user={user}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onUpdate={(data) => onUpdateUser(user.id, data)}
      />
    </TableRow>
  );
}


import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CreditCard,
  Edit,
  Loader2,
  MailIcon,
  MoreVertical,
  Trash,
} from "lucide-react";
import { EditUserDialog } from "./EditUserDialog";
import { AssignPlanDialog } from "./AssignPlanDialog";

interface UserTableRowProps {
  user: UserProfile & { subscription?: { plan_name: string } | null };
  isUpdating: boolean;
  onUpdateUser: (userId: string, data: Partial<UserProfile>) => void;
  onAssignPlan: (userId: string, planId: string) => void;
  onSendResetEmail: (email: string) => void;
  onDeleteUser: (userId: string, email: string) => void;
}

export function UserTableRow({
  user,
  isUpdating,
  onUpdateUser,
  onAssignPlan,
  onSendResetEmail,
  onDeleteUser,
}: UserTableRowProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAssignPlanDialogOpen, setIsAssignPlanDialogOpen] = useState(false);

  const handleUpdateUser = (data: Partial<UserProfile>) => {
    onUpdateUser(user.id, data);
    setIsEditDialogOpen(false);
  };

  const handleAssignPlan = (planId: string) => {
    onAssignPlan(user.id, planId);
    setIsAssignPlanDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    const success = await onDeleteUser(user.id, user.email);
    if (success) {
      setIsDeleteDialogOpen(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString();
  };

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="font-medium">{`${user.first_name} ${user.last_name}`}</div>
        </TableCell>
        <TableCell>{user.email}</TableCell>
        <TableCell>
          <span className="capitalize">{user.role}</span>
        </TableCell>
        <TableCell>{formatDate(user.created_at)}</TableCell>
        <TableCell>{formatDate(user.last_sign_in_at)}</TableCell>
        <TableCell>
          {user.subscription?.plan_name ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warm-gold/20 text-warm-gold">
              {user.subscription.plan_name}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              No Plan
            </span>
          )}
        </TableCell>
        <TableCell className="text-right">
          {isUpdating ? (
            <Button
              variant="ghost"
              size="icon"
              disabled
              className="h-8 w-8"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 p-0"
                >
                  <span className="sr-only">Open menu</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  <span>Edit User</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsAssignPlanDialogOpen(true)}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Assign Plan</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSendResetEmail(user.email)}>
                  <MailIcon className="mr-2 h-4 w-4" />
                  <span>Send Reset Email</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  <span>Delete User</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </TableCell>
      </TableRow>

      {/* Edit User Dialog */}
      <EditUserDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        user={user}
        onSave={handleUpdateUser}
      />

      {/* Assign Plan Dialog */}
      <AssignPlanDialog
        open={isAssignPlanDialogOpen}
        onOpenChange={setIsAssignPlanDialogOpen}
        userId={user.id}
        onAssign={handleAssignPlan}
      />

      {/* Delete User Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
              account for <strong>{user.email}</strong> and remove all their data
              from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


import React, { useState } from 'react';
import { MoreVertical, Edit, Trash2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast";
import { EditUserDialog } from './EditUserDialog';
import { AssignPlanDialog } from './AssignPlanDialog';
import { UserProfile } from "@/types";

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
  onDeleteUser
}: UserTableRowProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignPlanDialogOpen, setAssignPlanDialogOpen] = useState(false);

  const handleDelete = async () => {
    try {
      onDeleteUser(user.id, user.email);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="p-4">{user.first_name} {user.last_name}</td>
      <td className="p-4">{user.email}</td>
      <td className="p-4">{user.role || 'N/A'}</td>
      <td className="p-4">{new Date(user.created_at).toLocaleDateString()}</td>
      <td className="p-4">
        {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}
      </td>
      <td className="p-4">{user.subscription?.plan_name || 'None'}</td>
      <td className="p-4 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" disabled={isUpdating}>
              <span className="sr-only">Open menu</span>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAssignPlanDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Assign Plan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onSendResetEmail(user.email)}
              disabled={isUpdating}
            >
              Send Password Reset
            </DropdownMenuItem>
            <DropdownMenuItem>
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive hover:bg-destructive/5 focus-visible:bg-destructive/5 data-[state=open]:bg-destructive/5">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete user {user.email} from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
      
      <EditUserDialog 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen}
        user={user}
        onSave={(data: { email?: string; role?: string | null }) => {
          onUpdateUser(user.id, data);
          setEditDialogOpen(false);
        }}
      />

      <AssignPlanDialog
        open={assignPlanDialogOpen}
        onOpenChange={setAssignPlanDialogOpen}
        userId={user.id}
        onAssign={(planId: string) => {
          onAssignPlan(user.id, planId);
          setAssignPlanDialogOpen(false);
        }}
      />
    </tr>
  );
}

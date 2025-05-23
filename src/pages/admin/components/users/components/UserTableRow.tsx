
import React, { useState } from 'react';
import { MoreVertical, Edit, Trash2, UserPlus, Send, AlertTriangle } from 'lucide-react';
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
import { TableCell } from "@/components/ui/table";

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
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <tr className="border-b hover:bg-muted/50">
      <TableCell className="font-medium">
        {user.first_name || ''} {user.last_name || ''}
      </TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>{user.role || 'user'}</TableCell>
      <TableCell>{formatDate(user.created_at)}</TableCell>
      <TableCell>{formatDate(user.last_sign_in_at)}</TableCell>
      <TableCell>{user.subscription?.plan_name || 'None'}</TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={isUpdating}>
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
            <DropdownMenuItem onClick={() => onSendResetEmail(user.email)}>
              <Send className="mr-2 h-4 w-4" /> Send Reset Email
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4 text-destructive" />
              <span className="text-destructive">Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="prompt-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                Delete User Account
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the user account for <strong>{user.email}</strong>. This action cannot be undone and will remove all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="bg-white/40 p-6 rounded-xl border border-gray-200">
              <div className="flex items-center gap-3 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                <p className="font-medium">This action is irreversible</p>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                All user data, preferences, and subscription information will be permanently deleted.
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  onDeleteUser(user.id, user.email);
                  setDeleteDialogOpen(false);
                }}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
      
      <EditUserDialog 
        user={user} 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
        onSave={(userId, data) => onUpdateUser(userId, data)}
      />

      <AssignPlanDialog
        userId={user.id}
        open={assignPlanDialogOpen}
        onOpenChange={setAssignPlanDialogOpen}
        onAssign={(planId) => {
          onAssignPlan(user.id, planId);
          setAssignPlanDialogOpen(false);
        }}
      />
    </tr>
  );
}

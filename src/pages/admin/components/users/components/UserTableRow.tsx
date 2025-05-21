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

interface User {
  id: string;
  email: string;
  created_at: string;
  role: string | null;
}

interface UserTableRowProps {
  user: User;
  onDelete: (userId: string) => Promise<void>;
  onEdit: (userId: string, data: { email?: string; role?: string | null }) => Promise<void>;
  onAssignPlan: (userId: string) => void;
}

export function UserTableRow({ 
  user, 
  onDelete, 
  onEdit, 
  onAssignPlan 
}: UserTableRowProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignPlanDialogOpen, setAssignPlanDialogOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await onDelete(user.id);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  return (
    <tr className="border-b hover:bg-muted/50">
      <td className="p-4">{user.id}</td>
      <td className="p-4">{user.email}</td>
      <td className="p-4">{user.role || 'N/A'}</td>
      <td className="p-4">{new Date(user.created_at).toLocaleDateString()}</td>
      <td className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAssignPlan(user.id)}>
              <UserPlus className="mr-2 h-4 w-4" /> Assign Plan
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <AlertDialog>
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
          onEdit(user.id, data);
          setEditDialogOpen(false);
        }}
      />

      <AssignPlanDialog
        open={assignPlanDialogOpen}
        onOpenChange={setAssignPlanDialogOpen}
        userId={user.id}
      />
    </tr>
  );
}

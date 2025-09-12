
import React, { useState } from 'react';
import { MoreVertical, Edit, Trash2, UserPlus, Send, AlertTriangle, CreditCard, Key } from 'lucide-react';
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
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { UserProfile } from "@/types";
import { TableCell } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionActions } from "../hooks/useSubscriptionActions";

interface UserTableRowProps {
  user: UserProfile & { subscription?: { plan_name: string } | null, emailConfirmed?: boolean };
  isUpdating: boolean;
  onUpdateUser: (userId: string, data: Partial<UserProfile>) => void;
  onAssignPlan: (userId: string, planId: string) => void;
  onSendResetEmail: (email: string) => void;
  onDeleteUser: (userId: string, email: string) => void;
  onResendConfirmation: (userId: string, email: string) => void;
  onRefresh: () => void;
}

export function UserTableRow({ 
  user, 
  isUpdating,
  onUpdateUser,
  onAssignPlan,
  onSendResetEmail,
  onDeleteUser,
  onResendConfirmation,
  onRefresh
}: UserTableRowProps) {
  const { canDeleteUsers, canCancelSubscriptions, canChangePasswords, canFullCRUD } = useAuth();
  const { processingUserId, cancelUserSubscription } = useSubscriptionActions();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignPlanDialogOpen, setAssignPlanDialogOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const handleCancelSubscription = async () => {
    const success = await cancelUserSubscription(user.id, user.email);
    if (success) {
      onRefresh();
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'text-warm-gold bg-warm-gold/10';
      case 'jadmin':
        return 'text-orange-600 bg-orange-100';
      case 'prompter':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getSubscriptionBadgeColor = (planName: string | null) => {
    if (!planName || planName === 'None') {
      return 'text-gray-500 bg-gray-100';
    }
    
    switch (planName.toLowerCase()) {
      case 'basic':
        return 'text-green-600 bg-green-100';
      case 'standard':
        return 'text-blue-600 bg-blue-100';
      case 'premium':
        return 'text-purple-600 bg-purple-100';
      case 'lifetime':
        return 'text-warm-gold bg-warm-gold/10';
      default:
        return 'text-indigo-600 bg-indigo-100';
    }
  };

  return (
    <tr className="border-b hover:bg-muted/50">
      <TableCell className="font-medium">
        {user.first_name || ''} {user.last_name || ''}
      </TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>
        {user.emailConfirmed === false ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Unconfirmed
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Confirmed
          </span>
        )}
      </TableCell>
      <TableCell>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role || 'user')}`}>
          {user.role || 'user'}
        </span>
      </TableCell>
      <TableCell>{formatDate(user.created_at)}</TableCell>
      <TableCell>{formatDate(user.last_sign_in_at)}</TableCell>
      <TableCell>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSubscriptionBadgeColor(user.subscription?.plan_name || null)}`}>
          {user.subscription?.plan_name || 'None'}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={isUpdating || processingUserId === user.id}>
              <span className="sr-only">Open menu</span>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {canFullCRUD && (
              <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}
            {canFullCRUD && (
              <DropdownMenuItem onClick={() => setAssignPlanDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" /> Assign Plan
              </DropdownMenuItem>
            )}
            {canChangePasswords && (
              <DropdownMenuItem onClick={() => setChangePasswordDialogOpen(true)}>
                <Key className="mr-2 h-4 w-4" /> Change Password
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onSendResetEmail(user.email)}>
              <Send className="mr-2 h-4 w-4" /> Send Reset Email
            </DropdownMenuItem>
            {user.emailConfirmed === false && (
              <DropdownMenuItem onClick={() => onResendConfirmation(user.id, user.email)}>
                <Send className="mr-2 h-4 w-4" /> Resend Confirmation
              </DropdownMenuItem>
            )}
            
            {canCancelSubscriptions && user.subscription && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCancelSubscription}>
                  <CreditCard className="mr-2 h-4 w-4 text-orange-500" />
                  <span className="text-orange-500">Cancel Subscription</span>
                </DropdownMenuItem>
              </>
            )}
            
            {canDeleteUsers && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                  <span className="text-destructive">Delete</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {canDeleteUsers && (
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
        )}
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

      <ChangePasswordDialog
        user={user}
        open={changePasswordDialogOpen}
        onOpenChange={setChangePasswordDialogOpen}
        onSuccess={onRefresh}
      />
    </tr>
  );
}

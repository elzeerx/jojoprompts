import React, { useState } from 'react';
import { MoreVertical, Edit, Trash2, UserPlus, Send, AlertTriangle, CreditCard, Key, User as UserIcon, Receipt, CheckCircle } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"
import { toast } from "@/hooks/use-toast";
import { EditUserDialog } from './EditUserDialog';
import { AssignPlanDialog } from './AssignPlanDialog';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { TableCell } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { useUserService } from "../hooks/useUserService";
import { ExtendedUserProfile } from "@/types/user";
import { 
  RoleBadge, 
  VerificationBadge, 
  SubscriptionBadge,
  OrphanedBadge 
} from "./shared";

interface UserTableRowProps {
  user: ExtendedUserProfile & { 
    subscription?: { 
      plan_name: string;
      status: string;
      is_lifetime: boolean;
      price_usd: number;
    } | null;
    is_email_confirmed?: boolean | null;
    has_auth_account?: boolean;
  };
  isUpdating: boolean;
  onUpdateUser: (userId: string, data: Partial<ExtendedUserProfile>) => void;
  onAssignPlan: (userId: string, planId: string) => void;
  onSendResetEmail: (email: string) => void;
  onDeleteUser: (userId: string, email: string, firstName: string, lastName: string, role: string) => void;
  onResendConfirmation: (userId: string, email: string) => void;
  onResendPaymentEmail: (userId: string, email: string) => void;
  onConfirmEmail: (userId: string, userName?: string) => Promise<boolean>;
  onRefresh: () => void;
  onViewProfile?: () => void;
}

export function UserTableRow({ 
  user, 
  isUpdating,
  onUpdateUser,
  onAssignPlan,
  onSendResetEmail,
  onDeleteUser,
  onResendConfirmation,
  onResendPaymentEmail,
  onConfirmEmail,
  onRefresh,
  onViewProfile
}: UserTableRowProps) {
  const { canDeleteUsers, canCancelSubscriptions, canChangePasswords, canFullCRUD } = useAuth();
  const { processingUserId, cancelUserSubscription } = useUserService();
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

  return (
    <tr className="border-b hover:bg-muted/50">
      {/* User Info */}
      <TableCell className="font-medium">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
            {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
          </div>
          <div>
            <div className="font-medium">
              {user.first_name || ''} {user.last_name || ''}
            </div>
            <div className="text-sm text-muted-foreground">@{user.username}</div>
          </div>
        </div>
      </TableCell>

      {/* Contact */}
      <TableCell>
        <div>
          <div className="text-sm">{user.email}</div>
          {user.phone_number && (
            <div className="text-xs text-muted-foreground">{user.phone_number}</div>
          )}
        </div>
      </TableCell>

      {/* Role & Status */}
      <TableCell>
        <div className="space-y-1.5">
          <RoleBadge role={user.role || 'user'} size="sm" />
          <div className="flex flex-wrap gap-1">
            <VerificationBadge isVerified={user.is_email_confirmed} size="sm" showIcon={false} />
            <OrphanedBadge hasAuthAccount={user.has_auth_account ?? true} size="sm" />
          </div>
        </div>
      </TableCell>

      {/* Subscription */}
      <TableCell>
        <div className="space-y-1">
          <SubscriptionBadge 
            planName={user.subscription?.plan_name} 
            isLifetime={user.subscription?.is_lifetime}
            size="sm"
          />
          {user.subscription && (
            <div className="text-xs text-muted-foreground">
              ${user.subscription.price_usd}
              {user.subscription.is_lifetime ? ' (Lifetime)' : '/mo'}
            </div>
          )}
        </div>
      </TableCell>

      {/* Location */}
      <TableCell>
        <div className="text-sm">
          {user.country && (
            <div>{user.country}</div>
          )}
          {user.timezone && (
            <div className="text-xs text-muted-foreground">{user.timezone}</div>
          )}
          {!user.country && !user.timezone && (
            <span className="text-muted-foreground">N/A</span>
          )}
        </div>
      </TableCell>

      {/* Activity */}
      <TableCell>
        <div className="text-sm space-y-1">
          <div>Joined {formatDate(user.created_at)}</div>
          <div className="text-xs text-muted-foreground">
            Last seen {formatDate(user.last_sign_in_at)}
          </div>
        </div>
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
            {onViewProfile && (
              <DropdownMenuItem onClick={onViewProfile}>
                <UserIcon className="mr-2 h-4 w-4" /> View Profile
              </DropdownMenuItem>
            )}
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
              <DropdownMenuItem 
                onClick={() => {
                  if (user.has_auth_account === false) {
                    toast({
                      title: "Cannot change password",
                      description: "This user has an orphaned profile without a Supabase Auth account.",
                      variant: "destructive"
                    });
                    return;
                  }
                  setChangePasswordDialogOpen(true);
                }}
                className={user.has_auth_account === false ? "opacity-50" : ""}
              >
                <Key className="mr-2 h-4 w-4" /> 
                Change Password
                {user.has_auth_account === false && (
                  <span className="ml-2 text-xs text-amber-500">(Orphaned)</span>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={() => {
                if (user.has_auth_account === false) {
                  toast({
                    title: "Cannot send reset email",
                    description: "This user has an orphaned profile without a Supabase Auth account. Create an auth account first or delete this profile.",
                    variant: "destructive"
                  });
                  return;
                }
                onSendResetEmail(user.email!);
              }}
              className={user.has_auth_account === false ? "opacity-50" : ""}
            >
              <Send className="mr-2 h-4 w-4" /> 
              Send Reset Email
              {user.has_auth_account === false && (
                <span className="ml-2 text-xs text-amber-500">(Orphaned)</span>
              )}
            </DropdownMenuItem>
            {user.is_email_confirmed === false && (
              <DropdownMenuItem 
                onClick={() => {
                  if (user.has_auth_account === false) {
                    toast({
                      title: "Cannot resend confirmation",
                      description: "This user has an orphaned profile without a Supabase Auth account.",
                      variant: "destructive"
                    });
                    return;
                  }
                  onResendConfirmation(user.id, user.email!);
                }}
                className={user.has_auth_account === false ? "opacity-50" : ""}
              >
                <Send className="mr-2 h-4 w-4" /> 
                Resend Confirmation
                {user.has_auth_account === false && (
                  <span className="ml-2 text-xs text-amber-500">(Orphaned)</span>
                )}
              </DropdownMenuItem>
            )}
            {user.is_email_confirmed === false && canFullCRUD && user.has_auth_account !== false && (
              <DropdownMenuItem 
                onClick={async () => {
                  const success = await onConfirmEmail(user.id, `${user.first_name} ${user.last_name}`);
                  if (success) {
                    onRefresh();
                  }
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                <span className="text-green-600">Confirm Email (Admin)</span>
              </DropdownMenuItem>
            )}
            {user.subscription && (
              <DropdownMenuItem onClick={() => onResendPaymentEmail(user.id, user.email!)}>
                <Receipt className="mr-2 h-4 w-4 text-blue-600" />
                <span className="text-blue-600">Resend Payment Email</span>
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
                    onDeleteUser(user.id, user.email!, user.first_name, user.last_name, user.role);
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

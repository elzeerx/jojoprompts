import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, Info, FileText, Code, HelpCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { isAdmin as isAdminRole } from "@/utils/auth";

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  } | null;
  onConfirm: () => void;
  isDeleting: boolean;
  lastError?: {
    code?: string;
    message?: string;
    isRetryable?: boolean;
  } | null;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
  isDeleting,
  lastError,
}: DeleteUserDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [showManualSteps, setShowManualSteps] = useState(false);
  const [showSqlCommands, setShowSqlCommands] = useState(false);
  const isAdmin = isAdminRole(user?.role);
  const requiresDoubleConfirm = isAdmin;
  const expectedText = requiresDoubleConfirm ? "DELETE ADMIN" : "DELETE";
  const isConfirmValid = confirmText === expectedText;

  const openSupabaseDashboard = () => {
    window.open('https://supabase.com/dashboard/project/fxkqgjakbyrxkmevkglv/auth/users', '_blank');
  };

  const openSupabaseLogs = () => {
    window.open('https://supabase.com/dashboard/project/fxkqgjakbyrxkmevkglv/logs/explorer', '_blank');
  };

  const openSupabaseEditor = () => {
    window.open('https://supabase.com/dashboard/project/fxkqgjakbyrxkmevkglv/editor', '_blank');
  };

  // Get error-specific guidance
  const getErrorGuidance = () => {
    if (!lastError) return null;

    switch (lastError.code) {
      case 'FK_VIOLATION':
        return {
          title: 'Foreign Key Constraint Error',
          message: 'There are database references preventing deletion. This usually means related data still exists.',
          severity: 'destructive' as const,
          showSql: true
        };
      case 'USER_NOT_FOUND':
        return {
          title: 'User Not Found',
          message: 'The user no longer exists in the database. They may have been deleted already.',
          severity: 'default' as const,
          showSql: false
        };
      case 'INSUFFICIENT_PERMISSIONS':
        return {
          title: 'Permission Denied',
          message: 'You do not have sufficient permissions to delete this user. Contact the super administrator.',
          severity: 'destructive' as const,
          showSql: false
        };
      case 'RATE_LIMIT_EXCEEDED':
        return {
          title: 'Rate Limit Exceeded',
          message: 'Too many deletion attempts. Please wait a few minutes before trying again.',
          severity: 'default' as const,
          showSql: false
        };
      case 'DATABASE_ERROR':
        return {
          title: 'Database Error',
          message: 'A database error occurred. This may be temporary. Try again or use manual deletion.',
          severity: 'destructive' as const,
          showSql: true
        };
      case 'NETWORK_ERROR':
        return {
          title: 'Network Error',
          message: 'Connection issues prevented deletion. Check your internet connection and try again.',
          severity: 'default' as const,
          showSql: false
        };
      default:
        return {
          title: 'Deletion Error',
          message: lastError.message || 'An unknown error occurred during deletion.',
          severity: 'destructive' as const,
          showSql: true
        };
    }
  };

  const errorGuidance = getErrorGuidance();

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText("");
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    if (isConfirmValid && !isDeleting) {
      onConfirm();
    }
  };

  if (!user) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {isAdmin ? "Delete Administrator Account" : "Delete User Account"}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 text-left">
            {/* Show error guidance if there was a previous error */}
            {errorGuidance && (
              <Alert variant={errorGuidance.severity} className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{errorGuidance.title}</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>{errorGuidance.message}</p>
                  {lastError?.isRetryable && (
                    <p className="text-sm">This error may be temporary. You can try again.</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button
                      onClick={openSupabaseLogs}
                      variant="outline"
                      size="sm"
                      type="button"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      View Logs
                    </Button>
                    {errorGuidance.showSql && (
                      <Button
                        onClick={() => setShowSqlCommands(true)}
                        variant="outline"
                        size="sm"
                        type="button"
                      >
                        <Code className="h-3 w-3 mr-1" />
                        SQL Commands
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {isAdmin && !errorGuidance && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Warning: You are about to delete an administrator account. This
                  action is irreversible and will permanently remove all associated
                  data.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <p className="font-medium">User Details:</p>
              <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
                <p><span className="font-medium">Name:</span> {user.first_name} {user.last_name}</p>
                <p><span className="font-medium">Email:</span> {user.email}</p>
                <p><span className="font-medium">Role:</span> <span className="capitalize">{user.role}</span></p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-destructive font-medium">
                This will permanently delete:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>User profile and account data</li>
                <li>All prompts created by this user</li>
                <li>Subscriptions and payment history</li>
                <li>Collections and favorites</li>
                <li>All associated audit logs</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-text">
                Type <span className="font-mono font-bold">{expectedText}</span> to confirm:
              </Label>
              <Input
                id="confirm-text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={expectedText}
                className="font-mono"
                disabled={isDeleting}
              />
            </div>

            {/* Manual deletion instructions */}
            <Collapsible open={showManualSteps} onOpenChange={setShowManualSteps}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  type="button"
                >
                  <Info className="h-4 w-4 mr-2" />
                  {showManualSteps ? "Hide" : "Show"} Manual Deletion Instructions
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Manual Deletion via Supabase Dashboard</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p className="text-sm">If automatic deletion fails, follow these steps:</p>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>Click "Open Supabase Dashboard" below</li>
                      <li>Navigate to Authentication → Users</li>
                      <li>Find user: <span className="font-mono text-xs bg-muted px-1 rounded">{user.email}</span></li>
                      <li>Click the three dots (•••) next to the user</li>
                      <li>Select "Delete User"</li>
                      <li>Confirm the deletion</li>
                    </ol>
                    <div className="flex gap-2 mt-3">
                      <Button
                        onClick={openSupabaseDashboard}
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        type="button"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Dashboard
                      </Button>
                      <Button
                        onClick={openSupabaseLogs}
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        type="button"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Logs
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </CollapsibleContent>
            </Collapsible>

            {/* SQL commands for advanced users */}
            <Collapsible open={showSqlCommands} onOpenChange={setShowSqlCommands}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  type="button"
                >
                  <Code className="h-4 w-4 mr-2" />
                  {showSqlCommands ? "Hide" : "Show"} SQL Deletion Commands
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <Alert>
                  <Code className="h-4 w-4" />
                  <AlertTitle>Advanced: SQL Deletion</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p className="text-sm font-medium">Use these SQL commands in Supabase SQL Editor:</p>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-medium">1. Delete user data (preserves audit logs):</p>
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`SELECT admin_delete_user_data('${user.id}');`}
                        </pre>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium">2. Delete from auth (requires admin):</p>
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`-- Use Supabase Dashboard > Authentication > Users
-- to delete user: ${user.email}`}
                        </pre>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium">3. Check for foreign key issues:</p>
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
{`SELECT * FROM security_logs WHERE user_id = '${user.id}';
SELECT * FROM admin_audit_log WHERE admin_user_id = '${user.id}';`}
                        </pre>
                      </div>
                    </div>
                    <Button
                      onClick={openSupabaseEditor}
                      variant="secondary"
                      size="sm"
                      className="w-full mt-2"
                      type="button"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open SQL Editor
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      ⚠️ Use these commands only if you understand SQL and database operations.
                    </p>
                  </AlertDescription>
                </Alert>
              </CollapsibleContent>
            </Collapsible>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isConfirmValid || isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete Permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
  isDeleting,
}: DeleteUserDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [showManualSteps, setShowManualSteps] = useState(false);
  const isAdmin = user?.role === "admin";
  const requiresDoubleConfirm = isAdmin;
  const expectedText = requiresDoubleConfirm ? "DELETE ADMIN" : "DELETE";
  const isConfirmValid = confirmText === expectedText;

  const openSupabaseDashboard = () => {
    window.open('https://supabase.com/dashboard/project/fxkqgjakbyrxkmevkglv/auth/users', '_blank');
  };

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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {isAdmin ? "Delete Administrator Account" : "Delete User Account"}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 text-left">
            {isAdmin && (
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
                  <AlertDescription className="space-y-3">
                    <p className="font-medium">If automatic deletion fails, delete manually from Supabase:</p>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>Click "Open Supabase Dashboard" below</li>
                      <li>Navigate to Authentication → Users</li>
                      <li>Find user: <span className="font-mono text-xs bg-muted px-1 rounded">{user.email}</span></li>
                      <li>Click the three dots (•••) next to the user</li>
                      <li>Select "Delete User"</li>
                      <li>Confirm the deletion</li>
                    </ol>
                    <Button
                      onClick={openSupabaseDashboard}
                      variant="secondary"
                      size="sm"
                      className="w-full mt-2"
                      type="button"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Supabase Dashboard
                    </Button>
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

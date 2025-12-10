
import React, { useState } from "react";
import { createLogger } from '@/utils/logging';
import { handleError } from '@/utils/errorHandler';

const logger = createLogger('DELETE_ACCOUNT');
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface DeleteAccountDialogProps {
  hasActiveSubscription?: boolean;
  subscriptionPlan?: string;
}

export function DeleteAccountDialog({ 
  hasActiveSubscription = false, 
  subscriptionPlan 
}: DeleteAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleDeleteAccount = async () => {
    if (!user?.email || confirmationEmail !== user.email) {
      toast({
        title: "Invalid confirmation",
        description: "Please enter your email address to confirm deletion.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "delete-my-account",
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: { 
            confirmationEmail
          }
        }
      );

      if (error || (data && !data.success)) {
        throw new Error(error?.message || data?.error || "Failed to delete account");
      }

      toast({
        title: "Account Deleted",
        description: data.subscription_cancelled 
          ? "Your account and subscription have been deleted successfully."
          : "Your account has been deleted successfully.",
      });

      // Sign out and redirect to home
      await signOut();
      navigate('/');
      
    } catch (error: any) {
      const appError = handleError(error, { component: 'DeleteAccountDialog', action: 'deleteAccount' });
      logger.error('Error deleting account', appError);
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const isConfirmationValid = confirmationEmail === user?.email;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Account
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-4xl h-[90vh] flex flex-col p-0">
        {/* Fixed Header */}
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <span 
            className="inline-block rounded-lg text-white px-3 py-1 text-xs font-medium mb-3 bg-red-600"
          >
            Danger Zone
          </span>
          <DialogHeader className="text-left p-0">
            <DialogTitle className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              Delete Account
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground mt-2">
              This action cannot be undone. This will permanently delete your account and all associated data.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 px-6">
          <div className="py-6">
            <div className="bg-white/40 p-4 sm:p-6 rounded-xl border border-gray-200 space-y-6">
              {hasActiveSubscription && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Warning:</strong> You have an active {subscriptionPlan} subscription. 
                    It will be automatically cancelled when you delete your account.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  The following data will be permanently deleted:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Your profile and account information</li>
                  <li>• All your prompts and collections</li>
                  <li>• Your favorites and usage history</li>
                  <li>• Transaction history and subscription data</li>
                  {hasActiveSubscription && <li>• Your active subscription will be cancelled</li>}
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmEmail">
                  Type your email address to confirm: <span className="font-mono text-sm">{user?.email}</span>
                </Label>
                <Input
                  id="confirmEmail"
                  type="email"
                  placeholder="Enter your email address"
                  value={confirmationEmail}
                  onChange={(e) => setConfirmationEmail(e.target.value)}
                  disabled={isDeleting}
                />
              </div>
            </div>

            {/* Fixed Footer Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 pb-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isDeleting}
                className="px-6 py-3 text-base font-semibold rounded-xl order-2 sm:order-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={!isConfirmationValid || isDeleting}
                className="px-6 py-3 text-base font-semibold rounded-xl order-1 sm:order-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </>
                )}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

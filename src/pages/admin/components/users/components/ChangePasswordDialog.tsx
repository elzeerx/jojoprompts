import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Key, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ExtendedUserProfile } from "@/types/user";
import { useAdminErrorHandler } from "../hooks/useAdminErrorHandler";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ExtendedUserProfile | null;
  onSuccess?: () => void;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: ChangePasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { handleError } = useAdminErrorHandler();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPassword !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "The passwords do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Use edge function to change password via admin API
      const { data, error } = await supabase.functions.invoke('get-all-users', {
        body: {
          action: 'update',
          userId: user.id,
          password: newPassword
        }
      });

      if (error) throw error;
      
      if (data && !data.success && data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Password changed successfully!",
        description: `Password has been updated for ${user.email}`,
      });
      
      setNewPassword("");
      setConfirmPassword("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      handleError(error, "change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="prompt-dialog max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-2xl">
        <div className="p-5 sm:p-8">
          <DialogHeader className="mb-6 space-y-3">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
              <Key className="h-7 w-7 text-warm-gold sm:h-8 sm:w-8" />
              Change User Password
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Set a new password for <strong>{user?.email}</strong>. The user will be able to use this new password immediately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-6 rounded-xl border border-gray-200 bg-white/40 p-4 sm:p-6">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-medium">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="h-12 pe-12 text-base"
                    required
                    minLength={8}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute end-0 top-1/2 h-11 w-11 -translate-y-1/2 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide new password" : "Show new password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="h-12 pe-12 text-base"
                    required
                    minLength={8}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute end-0 top-1/2 h-11 w-11 -translate-y-1/2 p-0"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmed password"
                        : "Show confirmed password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                  <Key className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Password Requirements</h4>
                    <ul className="text-sm text-blue-700 mt-1 space-y-1">
                      <li>• Minimum 8 characters long</li>
                      <li>• User will be able to login immediately with the new password</li>
                      <li>• No email notification will be sent to the user</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="min-h-11 rounded-xl px-6 py-3 text-base font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="min-h-11 rounded-xl bg-[#c49d68] px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-[#c49d68]/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    Changing Password...
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

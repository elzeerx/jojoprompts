
import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, User, Shield } from "lucide-react";
import { ExtendedUserProfile } from "@/types/user";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ExtendedUserProfile | null;
  onSave: (userId: string, data: Partial<ExtendedUserProfile>) => void;
  isLoading?: boolean;
  canManageSensitiveFields: boolean;
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  onSave,
  isLoading = false,
  canManageSensitiveFields,
}: EditUserDialogProps) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    role: "user" as "user" | "admin" | "prompter" | "jadmin",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        username: user.username || "",
        email: user.email || "",
        role: user.role as "user" | "admin" | "prompter" | "jadmin",
      });
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const changes: Partial<ExtendedUserProfile> = {};
    
    if (formData.first_name !== (user.first_name || "")) {
      changes.first_name = formData.first_name;
    }
    if (formData.last_name !== (user.last_name || "")) {
      changes.last_name = formData.last_name;
    }
    if (formData.username !== (user.username || "")) {
      changes.username = formData.username;
    }
    if (
      canManageSensitiveFields &&
      formData.email !== (user.email || "")
    ) {
      changes.email = formData.email;
    }
    if (canManageSensitiveFields && formData.role !== user.role) {
      changes.role = formData.role;
    }

    if (Object.keys(changes).length > 0) {
      onSave(user.id, changes);
    }
    
    onOpenChange(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="prompt-dialog max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-2xl">
        <div className="p-5 sm:p-8">
          <DialogHeader className="mb-6 space-y-3">
            <DialogTitle className="flex items-center gap-3 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
              <User className="h-7 w-7 text-warm-gold sm:h-8 sm:w-8" />
              Edit User Details
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              {canManageSensitiveFields
                ? "Update profile information, account email, and authorization role."
                : "Update basic profile information. Sensitive account controls require a super admin."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-6 rounded-xl border border-gray-200 bg-white/40 p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    value={formData.first_name}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                    placeholder="Enter first name"
                    className="h-12 text-base"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    value={formData.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                    placeholder="Enter last name"
                    className="h-12 text-base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">
                  Username
                </Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                  placeholder="Enter username"
                  className="h-12 text-base"
                  minLength={3}
                  maxLength={30}
                  pattern="[a-zA-Z0-9_-]+"
                />
              </div>

              {canManageSensitiveFields && (
                <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="Enter email address"
                  className="h-12 text-base"
                />
              </div>
              )}

              {canManageSensitiveFields && (
                <div className="space-y-2">
                  <Label htmlFor="role" className="flex items-center gap-2 text-sm font-medium">
                    <Shield className="h-4 w-4" />
                    User Role
                  </Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => handleChange("role", value)}
                  >
                    <SelectTrigger id="role" className="h-12 text-base">
                      <SelectValue placeholder="Select user role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">User</span>
                          <span className="text-xs text-muted-foreground">Standard account access</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="prompter">
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-blue-600">Prompter</span>
                          <span className="text-xs text-muted-foreground">Can create and manage prompt content</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="jadmin">
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-orange-600">Junior Admin</span>
                          <span className="text-xs text-muted-foreground">Read-only administrative access</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex flex-col items-start">
                          <span className="font-medium text-warm-gold">Administrator</span>
                          <span className="text-xs text-muted-foreground">Operational administration access</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="min-h-11 rounded-xl px-6 py-3 text-base font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="min-h-11 rounded-xl bg-[#c49d68] px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-[#c49d68]/90"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

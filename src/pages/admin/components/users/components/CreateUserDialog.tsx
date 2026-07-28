import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus } from "lucide-react";
import { UserRole } from "@/types/user";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserService } from "../hooks/useUserService";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
  canAssignPrivilegedRoles?: boolean;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onUserCreated,
  canAssignPrivilegedRoles = false,
}: CreateUserDialogProps) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "user",
  });
  const { isProcessing: isCreating, createUser } = useUserService();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value: string) => {
    setFormData((prev) => ({ ...prev, role: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createUser({
      ...formData,
      role: (canAssignPrivilegedRoles ? formData.role : "user") as UserRole,
    });
    if (result) {
      onUserCreated();
      onOpenChange(false);
      // Reset the form
      setFormData({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        role: "user",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="prompt-dialog max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-2xl">
        <div className="p-5 sm:p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-bold text-gray-900 leading-tight flex items-center gap-3">
              <UserPlus className="h-8 w-8 text-warm-gold" />
              Create New User
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground mt-2">
              Create a confirmed account and assign its initial role.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white/40 p-4 sm:p-6 rounded-xl border border-gray-200 space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-base font-medium">
                    First Name
                  </Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder="Enter first name"
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-base font-medium">
                    Last Name
                  </Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder="Enter last name"
                    className="h-12 text-base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-base font-medium">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="user@example.com"
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-base font-medium">
                  Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                  className="h-12 text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters.
                </p>
              </div>

              {canAssignPrivilegedRoles ? (
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-base font-medium">
                    Role
                  </Label>
                  <Select
                    value={formData.role}
                    onValueChange={handleRoleChange}
                  >
                    <SelectTrigger id="role" className="h-12 text-base">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="prompter">Prompter</SelectItem>
                      <SelectItem value="jadmin">Junior Admin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-base font-medium">Role</Label>
                  <div className="flex min-h-12 items-center rounded-md border bg-muted/40 px-3 text-base">
                    User
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Only a super admin can create privileged accounts.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 pt-6 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}
                className="min-h-11 px-6 py-3 text-base font-semibold rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating}
                className="min-h-11 bg-[#c49d68] hover:bg-[#c49d68]/90 text-white px-6 py-3 text-base font-semibold rounded-xl shadow-md"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

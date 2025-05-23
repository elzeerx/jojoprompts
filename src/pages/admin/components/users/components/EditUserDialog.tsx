
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
import { UserProfile } from "@/types";

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onSave: (userId: string, data: Partial<UserProfile>) => void;
  isLoading?: boolean;
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  onSave,
  isLoading = false,
}: EditUserDialogProps) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "user" as "user" | "admin",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        role: user.role as "user" | "admin",
      });
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const changes: Partial<UserProfile> = {};
    
    if (formData.first_name !== (user.first_name || "")) {
      changes.first_name = formData.first_name;
    }
    if (formData.last_name !== (user.last_name || "")) {
      changes.last_name = formData.last_name;
    }
    if (formData.email !== (user.email || "")) {
      changes.email = formData.email;
    }
    if (formData.role !== user.role) {
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
      <DialogContent className="prompt-dialog">
        <div className="p-8">
          <DialogHeader className="space-y-3 mb-6">
            <DialogTitle className="text-3xl font-bold text-gray-900 leading-tight flex items-center gap-3">
              <User className="h-8 w-8 text-warm-gold" />
              Edit User Details
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Update the user's information and permissions. Changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white/40 p-6 rounded-xl border border-gray-200 space-y-6">
              <div className="grid grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <Label htmlFor="role" className="text-sm font-medium flex items-center gap-2">
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
                        <span className="text-xs text-muted-foreground">Standard access</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex flex-col items-start">
                        <span className="font-medium text-warm-gold">Administrator</span>
                        <span className="text-xs text-muted-foreground">Full system access</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="space-x-3 pt-6">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="px-6 py-3 text-base font-semibold rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-[#c49d68] hover:bg-[#c49d68]/90 text-white px-6 py-3 text-base font-semibold rounded-xl shadow-md"
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

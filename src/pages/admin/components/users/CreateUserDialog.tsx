
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CreateUserDialogProps {
  onUserCreated: () => void;
}

export function CreateUserDialog({ onUserCreated }: CreateUserDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // First, check if admin is logged in
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        throw new Error("You must be logged in to create users");
      }
      
      // Get the current origin with protocol
      const origin = window.location.origin;
      const loginUrl = `${origin}/login`;
      
      console.log(`Creating user with email ${email} and redirect URL: ${loginUrl}`);
      
      // Register the user using signUp method
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: loginUrl,
        }
      });
      
      if (signUpError) throw signUpError;
      
      if (!signUpData.user) {
        throw new Error("Failed to create user");
      }
      
      // Update the user's role in the profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', signUpData.user.id);

      if (profileError) throw profileError;
      
      // Send email notification manually if needed
      await sendWelcomeEmail(email);
      
      toast({
        title: "User created",
        description: `Successfully created user ${email}`,
      });
      
      setOpen(false);
      setEmail("");
      setPassword("");
      setRole("user");
      onUserCreated();
      
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast({
        title: "Error creating user",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendWelcomeEmail = async (userEmail: string) => {
    try {
      // Get the current origin with protocol
      const origin = window.location.origin;
      const loginUrl = `${origin}/login`;
      
      // Attempt to send a welcome email using Supabase Auth API
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: loginUrl,
      });
      
      if (error) {
        console.warn("Could not send welcome email:", error.message);
      } else {
        console.log("Welcome email sent successfully");
      }
    } catch (err) {
      console.warn("Failed to send welcome email:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="prompt-dialog">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create User"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

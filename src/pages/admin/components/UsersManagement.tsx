import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserCheck, UserX, Search, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CreateUserDialog } from "./users/CreateUserDialog";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  role: string;
  last_sign_in_at: string | null;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, role');
        
      if (profilesError) throw profilesError;
      
      if (!profilesData || profilesData.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }
      
      const userRoles = new Map(profilesData.map(p => [p.id, p.role]));
      
      const { data: session } = await supabase.auth.getSession();
      
      const userProfiles: UserProfile[] = profilesData.map(profile => {
        const userProfile: UserProfile = {
          id: profile.id,
          email: "User " + profile.id.substring(0, 6),
          created_at: new Date().toISOString(),
          role: profile.role,
          last_sign_in_at: null
        };
        
        if (session?.session?.user && profile.id === session.session.user.id) {
          userProfile.email = session.session.user.email || userProfile.email;
          userProfile.created_at = session.session.user.created_at || userProfile.created_at;
          userProfile.last_sign_in_at = session.session.user.last_sign_in_at;
        }
        
        return userProfile;
      });
      
      setUsers(userProfiles);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error fetching users",
        description: error.message || "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      setUpdatingUserId(userId);
      
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
        
      if (error) throw error;
      
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      
      toast({
        title: "Role updated",
        description: `User role has been changed to ${newRole}`,
      });
    } catch (error: any) {
      console.error("Error updating user role:", error);
      toast({
        title: "Error updating role",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const sendPasswordResetEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      toast({
        title: "Password reset email sent",
        description: `An email has been sent to ${email}`,
      });
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      toast({
        title: "Error sending email",
        description: error.message || "Failed to send password reset email",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">User Management</h3>
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <CreateUserDialog onUserCreated={fetchUsers} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Select
                        defaultValue={user.role}
                        onValueChange={(value) => updateUserRole(user.id, value)}
                        disabled={updatingUserId === user.id}
                      >
                        <SelectTrigger className="w-[110px]">
                          <SelectValue>
                            <div className="flex items-center">
                              {updatingUserId === user.id ? (
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              ) : user.role === "admin" ? (
                                <UserCheck className="mr-2 h-3 w-3 text-primary" />
                              ) : (
                                <UserX className="mr-2 h-3 w-3 text-muted-foreground" />
                              )}
                              {user.role}
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            <div className="flex items-center">
                              <UserCheck className="mr-2 h-4 w-4 text-primary" />
                              admin
                            </div>
                          </SelectItem>
                          <SelectItem value="user">
                            <div className="flex items-center">
                              <UserX className="mr-2 h-4 w-4 text-muted-foreground" />
                              user
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {user.last_sign_in_at 
                        ? new Date(user.last_sign_in_at).toLocaleDateString() 
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.email && !user.email.startsWith("User ") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => sendPasswordResetEmail(user.email)}
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Reset
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

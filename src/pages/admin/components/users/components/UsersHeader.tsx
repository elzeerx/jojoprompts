
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus } from "lucide-react";
import { CreateUserDialog } from "./CreateUserDialog";

interface UsersHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onUserCreated: () => void;
}

export function UsersHeader({ 
  searchTerm, 
  onSearchChange, 
  onUserCreated 
}: UsersHeaderProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
        <p className="text-muted-foreground">
          Manage users and their access levels
        </p>
      </div>
      <div className="flex flex-1 items-center space-x-2 md:max-w-sm md:justify-end">
        <Input
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="md:max-w-[180px] lg:max-w-[280px]"
        />
        <Button onClick={() => setCreateDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>
      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onUserCreated={onUserCreated}
      />
    </div>
  );
}

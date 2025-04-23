
import { CreateUserDialog } from "../CreateUserDialog";
import { UserSearch } from "../UserSearch";

interface UsersHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onUserCreated: () => void;
}

export function UsersHeader({ searchTerm, onSearchChange, onUserCreated }: UsersHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-medium">User Management</h3>
      <div className="flex items-center gap-4">
        <UserSearch 
          searchTerm={searchTerm} 
          onSearchChange={onSearchChange} 
        />
        <CreateUserDialog onUserCreated={onUserCreated} />
      </div>
    </div>
  );
}

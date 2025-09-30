
import React, { useState } from "react";
import { ExtendedUserProfile } from "@/types/user";
import { UserTableRow } from "./components/UserTableRow";
import { UserProfileCard } from "./components/UserProfileCard";
import { UserProfileModal } from "./components/UserProfileModal";
import { PaginationSection } from "./components/PaginationSection";
import { EditUserDialog } from "./components/EditUserDialog";
import { AssignPlanDialog } from "./components/AssignPlanDialog";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Grid, List, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface UsersTableProps {
  users: (ExtendedUserProfile & { 
    subscription?: { 
      plan_name: string;
      status: string;
      is_lifetime: boolean;
      price_usd: number;
    } | null;
    is_email_confirmed?: boolean;
  })[];
  currentPage: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  updatingUserId: string | null;
  onUpdateUser: (userId: string, data: Partial<ExtendedUserProfile>) => void;
  onAssignPlan: (userId: string, planId: string) => void;
  onSendResetEmail: (email: string) => void;
  onDeleteUser: (userId: string, email: string, firstName: string, lastName: string, role: string) => void;
  onResendConfirmation: (userId: string, email: string) => void;
  onRefresh: () => void;
  searchTerm?: string;
  onSearchChange?: (search: string) => void;
}

export function UsersTable({
  users,
  currentPage,
  totalPages,
  total,
  onPageChange,
  updatingUserId,
  onUpdateUser,
  onAssignPlan,
  onSendResetEmail,
  onDeleteUser,
  onResendConfirmation,
  onRefresh,
  searchTerm = "",
  onSearchChange
}: UsersTableProps) {
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedUser, setSelectedUser] = useState<ExtendedUserProfile | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignPlanDialogOpen, setAssignPlanDialogOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchTerm);
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Filter users based on role filter
  const filteredUsers = users.filter(user => {
    if (roleFilter === 'all') return true;
    return user.role === roleFilter;
  });

  const handleViewProfile = (user: ExtendedUserProfile) => {
    setSelectedUser(user);
    setProfileModalOpen(true);
  };

  const handleEditUser = (user: ExtendedUserProfile) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleAssignPlan = (user: ExtendedUserProfile) => {
    setSelectedUser(user);
    setAssignPlanDialogOpen(true);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchChange) {
      onSearchChange(localSearch);
    }
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No users found</h3>
          <p className="text-muted-foreground">
            {searchTerm ? "Try adjusting your search criteria" : "No users have been created yet"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Users</h2>
          <Badge variant="secondary">{total} total</Badge>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name, email, or username..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>

          {/* Filters */}
          <div className="flex gap-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="prompter">Prompter</SelectItem>
                <SelectItem value="jadmin">Junior Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className="flex bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-8 w-8 p-0"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 w-8 p-0"
              >
                <Grid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'table' ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role & Status</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <UserTableRow
                  key={user.id}
                  user={user}
                  isUpdating={updatingUserId === user.id}
                  onUpdateUser={onUpdateUser}
                  onAssignPlan={onAssignPlan}
                  onSendResetEmail={onSendResetEmail}
                  onDeleteUser={onDeleteUser}
                  onResendConfirmation={onResendConfirmation}
                  onRefresh={onRefresh}
                  onViewProfile={() => handleViewProfile(user)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredUsers.map((user) => (
            <UserProfileCard
              key={user.id}
              user={user}
              onEdit={() => handleEditUser(user)}
              onViewProfile={() => handleViewProfile(user)}
              onAssignPlan={() => handleAssignPlan(user)}
              onSendResetEmail={() => onSendResetEmail(user.email!)}
              onDeleteUser={() => onDeleteUser(user.id, user.email!, user.first_name, user.last_name, user.role)}
              isUpdating={updatingUserId === user.id}
            />
          ))}
        </div>
      )}
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <PaginationSection
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}

      {/* Modals */}
      <UserProfileModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        user={selectedUser}
        onSave={onUpdateUser}
        isLoading={updatingUserId === selectedUser?.id}
      />

      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onSave={onUpdateUser}
        isLoading={updatingUserId === selectedUser?.id}
      />

      {selectedUser && (
        <AssignPlanDialog
          userId={selectedUser.id}
          open={assignPlanDialogOpen}
          onOpenChange={setAssignPlanDialogOpen}
          onAssign={(planId) => {
            onAssignPlan(selectedUser.id, planId);
            setAssignPlanDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

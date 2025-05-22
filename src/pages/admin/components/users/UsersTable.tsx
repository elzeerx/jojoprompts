
import React from "react";
import { UserProfile } from "@/types";
import { UserTableRow } from "./components/UserTableRow";
import { PaginationSection } from "./components/PaginationSection";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UsersTableProps {
  users: (UserProfile & { subscription?: { plan_name: string } | null })[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  updatingUserId: string | null;
  onUpdateUser: (userId: string, data: Partial<UserProfile>) => void;
  onAssignPlan: (userId: string, planId: string) => void;
  onSendResetEmail: (email: string) => void;
  onDeleteUser: (userId: string, email: string) => void;
}

export function UsersTable({
  users,
  currentPage,
  totalPages,
  onPageChange,
  updatingUserId,
  onUpdateUser,
  onAssignPlan,
  onSendResetEmail,
  onDeleteUser,
}: UsersTableProps) {
  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No users found.
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Sign In</TableHead>
            <TableHead>Subscription</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <UserTableRow
              key={user.id}
              user={user}
              isUpdating={updatingUserId === user.id}
              onUpdateUser={onUpdateUser}
              onAssignPlan={onAssignPlan}
              onSendResetEmail={onSendResetEmail}
              onDeleteUser={onDeleteUser}
            />
          ))}
        </TableBody>
      </Table>
      
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <PaginationSection
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}

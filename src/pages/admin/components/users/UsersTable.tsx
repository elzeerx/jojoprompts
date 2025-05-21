
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserTableRow } from "./components/UserTableRow";
import { EmptyTableState } from "./components/EmptyTableState";
import { UserProfile } from "@/types";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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
    return <EmptyTableState />;
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Last Login</TableHead>
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

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage > 1) onPageChange(currentPage - 1);
              }}
            />
          </PaginationItem>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <PaginationItem key={page}>
              <PaginationLink
                href="#"
                isActive={currentPage === page}
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(page);
                }}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage < totalPages) onPageChange(currentPage + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

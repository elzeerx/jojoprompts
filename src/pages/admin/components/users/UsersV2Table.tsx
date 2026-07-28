import { useState } from "react";
import { ExtendedUserProfile } from "@/types/user";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Edit,
  Key,
  Send,
  User as UserIcon,
  CheckCircle,
  Search,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PaginationSection } from "./components/PaginationSection";
import { EditUserDialog } from "./components/EditUserDialog";
import { ChangePasswordDialog } from "./components/ChangePasswordDialog";
import { UserProfileSheet } from "./components/UserProfileSheet";
import { RoleBadge, VerificationBadge, OrphanedBadge } from "./components/shared";

export type UsersV2Row = ExtendedUserProfile & {
  is_email_confirmed?: boolean | null;
  has_auth_account?: boolean;
};

interface UsersV2TableProps {
  users: UsersV2Row[];
  currentPage: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onUpdateUser: (userId: string, data: Partial<ExtendedUserProfile>) => void;
  onSendResetEmail: (email: string) => void;
  onConfirmEmail: (userId: string, userName?: string) => Promise<boolean>;
  onRefresh: () => void;
  updatingUserId: string | null;
  canEditUsers: boolean;
  canManageSensitiveUsers: boolean;
}

export function UsersV2Table({
  users,
  currentPage,
  totalPages,
  total,
  onPageChange,
  onUpdateUser,
  onSendResetEmail,
  onConfirmEmail,
  onRefresh,
  updatingUserId,
  canEditUsers,
  canManageSensitiveUsers,
}: UsersV2TableProps) {
  const [selectedUser, setSelectedUser] = useState<UsersV2Row | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
        <h3 className="mt-3 text-base font-semibold">No users match</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Try clearing search or filters.
        </p>
      </div>
    );
  }

  const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString() : "—";

  return (
    <div className="space-y-4">
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role &amp; status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="align-top">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                        {(u.first_name?.[0] ?? "").toUpperCase()}
                        {(u.last_name?.[0] ?? "").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate">
                          {u.first_name || ""} {u.last_name || ""}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          @{u.username}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="max-w-[220px] truncate">{u.email}</div>
                    {u.phone_number && (
                      <div className="text-xs text-muted-foreground">
                        {u.phone_number}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <RoleBadge role={u.role || "user"} size="sm" />
                      <div className="flex flex-wrap gap-1">
                        <VerificationBadge
                          isVerified={u.is_email_confirmed}
                          size="sm"
                          showIcon={false}
                        />
                        <OrphanedBadge
                          hasAuthAccount={u.has_auth_account ?? true}
                          size="sm"
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{formatDate(u.created_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      Last seen {formatDate(u.last_sign_in_at)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions
                      user={u}
                      canEditUsers={canEditUsers}
                      canManageSensitiveUsers={canManageSensitiveUsers}
                      isUpdating={updatingUserId === u.id}
                      onView={() => {
                        setSelectedUser(u);
                        setProfileOpen(true);
                      }}
                      onEdit={() => {
                        setSelectedUser(u);
                        setEditOpen(true);
                      }}
                      onPassword={() => {
                        setSelectedUser(u);
                        setPasswordOpen(true);
                      }}
                      onSendReset={() => onSendResetEmail(u.email!)}
                      onConfirmEmail={async () => {
                        const ok = await onConfirmEmail(
                          u.id,
                          `${u.first_name} ${u.last_name}`,
                        );
                        if (ok) onRefresh();
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile stacked cards */}
      <ul className="space-y-3 md:hidden">
        {users.map((u) => (
          <li
            key={u.id}
            className="rounded-lg border p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {u.first_name || ""} {u.last_name || ""}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {u.email}
                </div>
              </div>
              <RowActions
                user={u}
                canEditUsers={canEditUsers}
                canManageSensitiveUsers={canManageSensitiveUsers}
                isUpdating={updatingUserId === u.id}
                onView={() => {
                  setSelectedUser(u);
                  setProfileOpen(true);
                }}
                onEdit={() => {
                  setSelectedUser(u);
                  setEditOpen(true);
                }}
                onPassword={() => {
                  setSelectedUser(u);
                  setPasswordOpen(true);
                }}
                onSendReset={() => onSendResetEmail(u.email!)}
                onConfirmEmail={async () => {
                  const ok = await onConfirmEmail(
                    u.id,
                    `${u.first_name} ${u.last_name}`,
                  );
                  if (ok) onRefresh();
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <RoleBadge role={u.role || "user"} size="sm" />
              <VerificationBadge
                isVerified={u.is_email_confirmed}
                size="sm"
                showIcon={false}
              />
              <OrphanedBadge
                hasAuthAccount={u.has_auth_account ?? true}
                size="sm"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Joined {formatDate(u.created_at)} · Last seen{" "}
              {formatDate(u.last_sign_in_at)}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="text-xs text-muted-foreground">
          {total.toLocaleString()} user{total === 1 ? "" : "s"}
        </div>
        {totalPages > 1 && (
          <PaginationSection
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        )}
      </div>

      <UserProfileSheet
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={selectedUser}
      />
      <EditUserDialog
        user={selectedUser}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={(id, data) => onUpdateUser(id, data)}
        canManageSensitiveFields={canManageSensitiveUsers}
      />
      <ChangePasswordDialog
        user={selectedUser}
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        onSuccess={onRefresh}
      />
    </div>
  );
}

interface RowActionsProps {
  user: UsersV2Row;
  canEditUsers: boolean;
  canManageSensitiveUsers: boolean;
  isUpdating: boolean;
  onView: () => void;
  onEdit: () => void;
  onPassword: () => void;
  onSendReset: () => void;
  onConfirmEmail: () => void;
}

function RowActions({
  user,
  canEditUsers,
  canManageSensitiveUsers,
  isUpdating,
  onView,
  onEdit,
  onPassword,
  onSendReset,
  onConfirmEmail,
}: RowActionsProps) {
  const orphan = user.has_auth_account === false;
  const guardOrphan = (label: string, fn: () => void) => () => {
    if (orphan) {
      toast({
        title: `Cannot ${label}`,
        description:
          "User profile has no Supabase Auth account attached.",
        variant: "destructive",
      });
      return;
    }
    fn();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isUpdating}
          className="min-h-[44px] min-w-[44px]"
          aria-label="User actions"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Account actions</DropdownMenuLabel>
        <DropdownMenuItem onClick={onView} className="min-h-[44px]">
          <UserIcon className="mr-2 h-4 w-4" /> View profile
        </DropdownMenuItem>
        {canEditUsers && (
          <DropdownMenuItem onClick={onEdit} className="min-h-[44px]">
            <Edit className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
        )}
        {canManageSensitiveUsers && (
          <DropdownMenuItem
            onClick={guardOrphan("change password", onPassword)}
            className="min-h-[44px]"
          >
            <Key className="mr-2 h-4 w-4" /> Change password
          </DropdownMenuItem>
        )}
        {canEditUsers && (
          <DropdownMenuItem
            onClick={guardOrphan("send reset email", onSendReset)}
            className="min-h-[44px]"
          >
            <Send className="mr-2 h-4 w-4" /> Send password reset
          </DropdownMenuItem>
        )}
        {user.is_email_confirmed === false &&
          canManageSensitiveUsers &&
          !orphan && (
          <DropdownMenuItem
            onClick={onConfirmEmail}
            className="min-h-[44px]"
          >
            <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" />
            <span className="text-emerald-600">Confirm email (admin)</span>
          </DropdownMenuItem>
          )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

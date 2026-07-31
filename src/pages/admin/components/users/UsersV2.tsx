import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, RefreshCw, UserPlus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useUserManagement } from "./hooks/useUserManagement";
import { useUserBulkActions } from "./hooks/useUserBulkActions";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { UsersV2Table } from "./UsersV2Table";
import { CreateUserDialog } from "./components/CreateUserDialog";

/**
 * V2 People / Users operations surface.
 *
 * Scope contract (Phase 6E — People cleanup):
 *   - Single H1 heading, single toolbar, one compact stats row.
 *   - No subscription / plan / marketing terminology or primary controls.
 *   - No permanent Delete or Bulk Delete controls in the primary UI.
 *   - No duplicate User Activity Log tab — Admin Activity remains canonical
 *     at /admin/trust/admin-activity.
 *   - Preserves admin/super-admin authorization behaviour.
 */
export default function UsersV2() {
  const { isAdmin } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const [createOpen, setCreateOpen] = useState(false);

  const {
    users,
    total,
    totalPages,
    currentPage,
    searchTerm,
    verificationFilter,
    accountStatusFilter,
    orphanedCount,
    loading,
    error,
    updateUser,
    confirmUserEmail,
    onPageChange,
    onSearchChange,
    onVerificationFilterChange,
    onAccountStatusFilterChange,
    refetch,
    sendPasswordResetEmail,
  } = useUserManagement();

  const { exportUsers } = useUserBulkActions();

  const unverified = users.filter((u) => u.is_email_confirmed === false).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-dark-base sm:text-2xl">
          Users
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage accounts, roles, entitlements, verification, and account status.
          Admin activity is recorded in{" "}
          <a
            href="/admin/operations?tab=admin-activity"
            className="-mx-1 inline-flex min-h-[44px] items-center px-1 underline underline-offset-2 hover:text-dark-base sm:mx-0 sm:min-h-0 sm:px-0"
          >
            Admin Activity
          </a>
          .
        </p>
      </header>

      {isSuperAdmin && (
        <Alert className="border-warm-gold bg-warm-gold/5">
          <AlertCircle className="h-4 w-4 text-warm-gold" />
          <AlertDescription>
            Super Admin — full account controls are available via row actions.
          </AlertDescription>
        </Alert>
      )}

      {/* Compact stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total users" value={total} />
        <StatCard label="Unverified (page)" value={unverified} />
        <StatCard label="Orphaned profiles" value={orphanedCount ?? 0} />
        <StatCard label="Loaded" value={users.length} />
      </div>

      {/* Single toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <div className="w-full md:flex-1 md:min-w-[240px]">
          <Input
            aria-label="Search users"
            placeholder="Search by name, email, or username"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full min-h-[44px]"
          />
        </div>

        <Select
          value={verificationFilter}
          onValueChange={onVerificationFilterChange}
        >
          <SelectTrigger className="w-full min-h-[44px] md:w-[180px]" aria-label="Verification filter">
            <SelectValue placeholder="Verification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={accountStatusFilter}
          onValueChange={onAccountStatusFilterChange}
        >
          <SelectTrigger className="w-full min-h-[44px] md:w-[200px]" aria-label="Account status filter">
            <SelectValue placeholder="Account status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            <SelectItem value="active">Active (has auth)</SelectItem>
            <SelectItem value="orphaned">Orphaned (no auth)</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
            className="min-h-[44px]"
            aria-label="Refresh users"
          >
            <RefreshCw className={`me-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportUsers(users, "csv")}
            className="min-h-[44px]"
            disabled={users.length === 0}
          >
            <Download className="me-1 h-4 w-4" />
            Export CSV
          </Button>
          {isAdmin && (
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="min-h-[44px]"
            >
              <UserPlus className="me-1 h-4 w-4" />
              New user
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Failed to load users.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="min-h-[44px]"
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        </div>
      ) : (
        <UsersV2Table
          users={users}
          currentPage={currentPage}
          totalPages={totalPages}
          total={total}
          onPageChange={onPageChange}
          onUpdateUser={updateUser}
          onSendResetEmail={sendPasswordResetEmail}
          onConfirmEmail={confirmUserEmail}
          onRefresh={refetch}
          updatingUserId={null}
          canEditUsers={isAdmin}
          canManageSensitiveUsers={isSuperAdmin}
        />
      )}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onUserCreated={refetch}
        canAssignPrivilegedRoles={isSuperAdmin}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="h-[70px]">
      <CardContent className="flex h-full flex-col justify-between p-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-lg font-semibold tabular-nums text-dark-base">
          {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

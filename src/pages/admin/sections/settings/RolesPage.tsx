import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  Crown,
  Award,
  Users as UsersIcon,
  Search,
  RefreshCw,
  Trash2,
  Plus,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateTime } from "@/lib/v2/admin/format";
import {
  ALL_ROLES,
  ASSIGNABLE_ROLES,
  LEGACY_ROLES,
  isLastAdminRemovalBlocked,
  isRemovableRole,
  resolveAssignerLabel,
  selectLatestRoleRow,
  formatUserCountFooter,
} from "@/lib/v2/admin/roles";
import {
  useAdminRoleCounts,
  useAdminRoleList,
  useAssignRole,
  useRemoveRole,
} from "@/hooks/admin/v2/useAdminRoles";
import type {
  AppRole,
  ProfileLite,
  RoleUserRow,
} from "@/hooks/admin/v2/useAdminRolesTypes";

const PAGE_SIZE = 25;

const ROLE_ICON: Record<AppRole, JSX.Element> = {
  admin: <Crown className="h-4 w-4" />,
  jadmin: <Shield className="h-4 w-4" />,
  prompter: <Award className="h-4 w-4" />,
  user: <UsersIcon className="h-4 w-4" />,
};

function roleTone(
  role: AppRole,
): "default" | "secondary" | "destructive" | "outline" {
  if (role === "admin") return "destructive";
  if (role === "jadmin") return "secondary";
  if (role === "prompter") return "default";
  return "outline";
}

function displayName(row: RoleUserRow): string {
  const p = row.profile;
  if (!p) return row.user_id.slice(0, 8);
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return full || p.username || p.email || row.user_id.slice(0, 8);
}

interface PendingAssign {
  kind: "assign";
  userId: string;
  userLabel: string;
  role: AppRole;
}
interface PendingRemove {
  kind: "remove";
  userId: string;
  userLabel: string;
  role: AppRole;
}
type Pending = PendingAssign | PendingRemove;

export default function RolesPage() {
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<Pending | null>(null);

  const counts = useAdminRoleCounts();
  const list = useAdminRoleList({
    search,
    roleFilter,
    page,
    pageSize: PAGE_SIZE,
  });

  const assign = useAssignRole();
  const remove = useRemoveRole();

  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const adminCount = counts.data?.admin ?? 0;
  const onlyOneAdmin = adminCount === 1;

  const roleSummary = useMemo(
    () => [
      { role: "admin" as AppRole, label: "Admins" },
      { role: "prompter" as AppRole, label: "Prompters" },
      { role: "user" as AppRole, label: "Users" },
      { role: "jadmin" as AppRole, label: "Legacy jadmin" },
    ],
    [],
  );

  const submit = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const confirmPending = async () => {
    if (!pending) return;
    try {
      if (pending.kind === "assign") {
        await assign.mutateAsync({ userId: pending.userId, role: pending.role });
        toast({
          title: "Role assigned",
          description: `${pending.role} → ${pending.userLabel}`,
        });
      } else {
        await remove.mutateAsync({ userId: pending.userId, role: pending.role });
        toast({
          title: "Role removed",
          description: `${pending.role} ← ${pending.userLabel}`,
        });
      }
      counts.refetch();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Role change failed";
      toast({
        variant: "destructive",
        title: "Role change blocked",
        description: message,
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0" dir="ltr">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-warm-gold" />
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight break-words">
              Roles
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Manage admin, prompter, and standard user role assignments backed by
            <code className="mx-1">user_roles</code>. Legacy jadmin rows are
            read-only. For account or profile edits, use People → Users.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-[44px]"
          >
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-1.5"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Open Users
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => {
              list.refetch();
              counts.refetch();
            }}
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {roleSummary.map(({ role, label }) => (
          <Card key={role} className="min-w-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium truncate">
                {label}
              </CardTitle>
              {ROLE_ICON[role]}
            </CardHeader>
            <CardContent>
              {counts.isLoading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <div className="text-2xl font-bold">
                  {counts.data?.[role] ?? 0}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                Period: not applicable
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {onlyOneAdmin && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Only one admin exists. Removal of the last admin is blocked by the
            server; assign another admin before removing this one.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <form
          className="sm:col-span-2 flex items-center gap-2 min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, email, or username"
              className="pl-9 min-h-[44px] w-full"
              aria-label="Search users"
            />
          </div>
          <Button type="submit" className="min-h-[44px]">
            Search
          </Button>
        </form>
        <Select
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v as AppRole | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="min-h-[44px]" aria-label="Filter by role">
            <SelectValue placeholder="Any role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any role</SelectItem>
            {ALL_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {list.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive break-words">
          Error: {(list.error as Error).message}
        </div>
      )}

      {list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : isMobile ? (
        <div className="space-y-2">
          {(list.data?.rows ?? []).map((row) => (
            <RoleUserCard
              key={row.user_id}
              row={row}
              adminCount={adminCount}
              busy={assign.isPending || remove.isPending}
              assignerProfilesById={
                list.data?.assignerProfilesById ?? new Map()
              }
              onAssign={(role) =>
                setPending({
                  kind: "assign",
                  userId: row.user_id,
                  userLabel: displayName(row),
                  role,
                })
              }
              onRemove={(role) =>
                setPending({
                  kind: "remove",
                  userId: row.user_id,
                  userLabel: displayName(row),
                  role,
                })
              }
            />
          ))}
          {(list.data?.rows.length ?? 0) === 0 && (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              No matching users
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="w-[220px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data?.rows ?? []).map((row) => {
                const roles = row.roles.map((r) => r.role);
                const latest = selectLatestRoleRow(row.roles);
                return (
                  <TableRow key={row.user_id}>
                    <TableCell className="text-xs">
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate max-w-[240px]">
                          {displayName(row)}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                          {row.profile?.email ?? row.user_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {roles.map((r) => (
                          <Badge key={r} variant={roleTone(r)}>
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {latest?.assigned_at
                        ? formatDateTime(latest.assigned_at)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="truncate max-w-[180px] inline-block align-bottom">
                        {resolveAssignerLabel(
                          latest?.assigned_by ?? null,
                          list.data?.assignerProfilesById ?? new Map(),
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <RowActions
                        row={row}
                        adminCount={adminCount}
                        busy={assign.isPending || remove.isPending}
                        onAssign={(role) =>
                          setPending({
                            kind: "assign",
                            userId: row.user_id,
                            userLabel: displayName(row),
                            role,
                          })
                        }
                        onRemove={(role) =>
                          setPending({
                            kind: "remove",
                            userId: row.user_id,
                            userLabel: displayName(row),
                            role,
                          })
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {(list.data?.rows.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No matching users
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          {formatUserCountFooter(total, page, totalPages)}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "assign" ? "Assign role" : "Remove role"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? `${pending.kind === "assign" ? "Grant" : "Revoke"} the "${pending.role}" role ${pending.kind === "assign" ? "to" : "from"} ${pending.userLabel}. This change is logged to the audit feed.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[44px]"
              onClick={(e) => {
                e.preventDefault();
                void confirmPending();
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ActionsProps {
  row: RoleUserRow;
  adminCount: number;
  busy: boolean;
  onAssign: (role: AppRole) => void;
  onRemove: (role: AppRole) => void;
}

function RowActions({ row, adminCount, busy, onAssign, onRemove }: ActionsProps) {
  const existing = new Set(row.roles.map((r) => r.role));
  const assignable = ASSIGNABLE_ROLES.filter((r) => !existing.has(r));

  return (
    <div className="flex flex-wrap gap-1.5">
      {assignable.length > 0 && (
        <Select onValueChange={(v) => onAssign(v as AppRole)}>
          <SelectTrigger
            className="min-h-[44px] w-[130px]"
            aria-label="Assign role"
            disabled={busy}
          >
            <SelectValue placeholder="Assign…" />
          </SelectTrigger>
          <SelectContent>
            {assignable.map((r) => (
              <SelectItem key={r} value={r}>
                <span className="inline-flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  {r}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {row.roles
        .filter((r) => isRemovableRole(r.role))
        .map((r) => {
          const isLastAdminRemoval = isLastAdminRemovalBlocked(r.role, adminCount);
          return (
            <Button
              key={r.id}
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              disabled={busy || isLastAdminRemoval}
              onClick={() => onRemove(r.role)}
              aria-label={`Remove role ${r.role}`}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {r.role}
            </Button>
          );
        })}
    </div>
  );
}

function RoleUserCard(props: ActionsProps) {
  const { row } = props;
  const roles = row.roles.map((r) => r.role);
  return (
    <Card>
      <CardContent className="p-3 space-y-2 min-w-0">
        <div className="min-w-0">
          <div className="font-medium text-sm break-words">
            {displayName(row)}
          </div>
          <div className="text-[11px] text-muted-foreground break-words">
            {row.profile?.email ?? row.user_id}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {roles.map((r) => (
            <Badge key={r} variant={roleTone(r)}>
              {r}
            </Badge>
          ))}
        </div>
        <RowActions {...props} />
      </CardContent>
    </Card>
  );
}

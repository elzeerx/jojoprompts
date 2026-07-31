import { Link } from "react-router-dom";
import {
  Shield, RefreshCw, AlertTriangle, Info, Lock, Database,
  Users as UsersIcon, KeyRound, CheckCircle2, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/v2/admin/format";
import { useAdminRolesSettingsStatus } from "@/hooks/admin/v2/useAdminRolesSettingsStatus";
import {
  ROLES_NAV_LINKS,
  roleStatusLabel,
  roleStatusTone,
  jadminMismatchNotice,
  type StatusTone,
  type RoleDefinition,
} from "@/lib/v2/admin/rolesSettings";

function tone(t: StatusTone): string {
  switch (t) {
    case "ok": return "border-emerald-500/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200";
    case "warn": return "border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-200";
    case "danger": return "border-red-500/40 bg-red-500/5 text-red-800 dark:text-red-200";
    default: return "border-border bg-muted/40 text-foreground";
  }
}

function Metric({
  label, value, hint,
}: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border p-3 min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
        {label}
      </div>
      <div className="text-xl sm:text-2xl font-semibold mt-1 break-words">
        {value}
      </div>
      {hint ? (
        <div className="text-[11px] text-muted-foreground mt-1 break-words">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function BoolPill({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  const cls = ok
    ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200"
    : "border-red-500/40 bg-red-500/5 text-red-800 dark:text-red-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="break-words">{label}</span>
    </span>
  );
}

function RoleCard({ def, count, superCount }: {
  def: RoleDefinition; count: number; superCount: number;
}) {
  const t = tone(roleStatusTone(def.status));
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm sm:text-base break-words">
            {def.label}
          </CardTitle>
          <Badge variant="outline" className="text-[10px] uppercase">
            {def.id}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`rounded-md border px-2 py-1 text-[11px] inline-block ${t}`}>
          {roleStatusLabel(def.status)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Users" value={count} />
          {def.super_admin_supported ? (
            <Metric label="Super-admins" value={superCount} />
          ) : (
            <Metric label="Super-admin" value="Not supported" />
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <BoolPill ok={def.admin_v2} label="Admin V2 access" />
          <BoolPill ok={def.legacy_prompt_management} label="Legacy prompt mgmt" />
          <BoolPill ok={def.default_on_signup} label="Signup default" />
        </div>
        {def.status === "legacy_partial" ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/5 p-2 text-[11px] text-red-800 dark:text-red-200 break-words">
            {jadminMismatchNotice()}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function RolesPage() {
  const q = useAdminRolesSettingsStatus();

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0" dir="ltr">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-warm-gold" aria-hidden />
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight break-words">
              Roles & permissions
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl break-words">
            Read-only overview of the role system: how many accounts hold each
            role, which authorization contracts apply, and which safety boundaries
            this page intentionally does not touch. Role changes are performed
            individually from People → Users.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Last checked:{" "}
            {q.data ? formatDateTime(q.data.as_of) : q.isLoading ? "Loading…" : "—"}
          </p>
        </div>
        <Button
          variant="outline"
          className="min-h-[44px]"
          onClick={() => q.refetch()}
          disabled={q.isFetching}
          aria-label="Refresh roles status"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${q.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {q.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive break-words">
          Roles status is temporarily unavailable. Try refreshing.
        </div>
      ) : null}

      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : q.data ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Users with roles" value={q.data.users_with_roles} />
            <Metric label="Role assignments" value={q.data.total_assignments} />
            <Metric label="Super-admins" value={q.data.super_admin_count} />
            <Metric
              label="Need a role"
              value={q.data.auth_users_without_roles}
              hint="Auth accounts without any role row"
            />
          </div>

          {q.data.auth_users_without_roles > 0 ? (
            <div className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-900 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 min-w-0">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
                <span className="break-words">
                  {q.data.auth_users_without_roles} auth account
                  {q.data.auth_users_without_roles === 1 ? "" : "s"} do not have
                  any role row. Assign at least the <code>user</code> role from
                  the Users page.
                </span>
              </div>
              <Button asChild variant="outline" size="sm" className="min-h-[44px] shrink-0">
                <Link to="/admin/people?tab=users">Open Users</Link>
              </Button>
            </div>
          ) : null}

          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <UsersIcon className="h-4 w-4" aria-hidden /> Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Metric label="Auth accounts" value={q.data.auth_users_total} />
                <Metric label="Profiles" value={q.data.profiles_total} />
                <Metric label="Users with roles" value={q.data.users_with_roles} />
                <Metric label="Accounts without a role" value={q.data.auth_users_without_roles} />
                <Metric label="Profiles without a role" value={q.data.profiles_without_roles} />
                <Metric label="Multiple-role users" value={q.data.users_with_multiple_roles} />
                <Metric
                  label="Last role assigned"
                  value={q.data.last_assigned_at ? formatDateTime(q.data.last_assigned_at) : "—"}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {q.data.role_definitions.map((def) => (
              <RoleCard
                key={def.id}
                def={def}
                count={q.data!.role_counts[def.id]}
                superCount={q.data!.super_admin_count}
              />
            ))}
          </div>

          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4" aria-hidden /> Authorization contract
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
                <div className="rounded-md border p-2">
                  <dt className="text-[11px] uppercase text-muted-foreground">Role store</dt>
                  <dd className="mt-0.5 font-mono break-all">{q.data.authorization_contract.role_store}</dd>
                </div>
                <div className="rounded-md border p-2">
                  <dt className="text-[11px] uppercase text-muted-foreground">Admin V2 gate</dt>
                  <dd className="mt-0.5 break-words">{q.data.authorization_contract.admin_v2_gate}</dd>
                </div>
                <div className="rounded-md border p-2">
                  <dt className="text-[11px] uppercase text-muted-foreground">Admin V2 required role</dt>
                  <dd className="mt-0.5"><code>{q.data.authorization_contract.admin_v2_required_role}</code></dd>
                </div>
                <div className="rounded-md border p-2">
                  <dt className="text-[11px] uppercase text-muted-foreground">Signup default role</dt>
                  <dd className="mt-0.5"><code>{q.data.authorization_contract.signup_default_role}</code></dd>
                </div>
                <div className="rounded-md border p-2 sm:col-span-2">
                  <dt className="text-[11px] uppercase text-muted-foreground">Role source</dt>
                  <dd className="mt-0.5 break-words">{q.data.authorization_contract.role_source}</dd>
                </div>
                <div className="rounded-md border p-2">
                  <dt className="text-[11px] uppercase text-muted-foreground">Legacy is_admin helper accepts</dt>
                  <dd className="mt-0.5 flex flex-wrap gap-1">
                    {q.data.authorization_contract.legacy_admin_helper_roles.map((r) => (
                      <Badge key={r} variant="outline">{r}</Badge>
                    ))}
                  </dd>
                </div>
                <div className="rounded-md border p-2">
                  <dt className="text-[11px] uppercase text-muted-foreground">Legacy prompt mgmt accepts</dt>
                  <dd className="mt-0.5 flex flex-wrap gap-1">
                    {q.data.authorization_contract.legacy_prompt_management_roles.map((r) => (
                      <Badge key={r} variant="outline">{r}</Badge>
                    ))}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Database className="h-4 w-4" aria-hidden /> Database controls
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <BoolPill ok={q.data.rls_enabled} label="RLS enabled on user_roles" />
              <BoolPill ok={q.data.unique_user_role_constraint} label="Unique (user_id, role)" />
              <BoolPill ok label="Database role lookup" />
              <BoolPill ok label="Not from user_metadata" />
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-100">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <div className="min-w-0 break-words">
              <div className="font-medium">Role changes are intentionally unavailable here.</div>
              <div className="mt-1">
                Assignments and revocations are performed one account at a time
                from <Link to="/admin/people?tab=users" className="underline">People → Users</Link>.
                Bulk mutation from this page is disabled until a lockout-safe,
                fully audited workflow lands and the legacy <code>jadmin</code>
                {" "}and prompter admin helpers are harmonized with the Admin V2
                gate.
              </div>
              <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                <li>Role mutation: <code>{q.data.boundaries.role_mutation}</code></li>
                <li>Session revocation: <code>{q.data.boundaries.session_revocation}</code></li>
                <li>JWT custom claims: <code>{q.data.boundaries.jwt_custom_claims}</code></li>
                <li>Policy effectiveness: <code>{q.data.boundaries.policy_effectiveness}</code></li>
                <li>User identity: <code>{q.data.boundaries.user_identity}</code></li>
              </ul>
            </div>
          </div>

          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Info className="h-4 w-4" aria-hidden /> Related admin surfaces
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {ROLES_NAV_LINKS.map((l) => (
                <Button
                  key={l.to}
                  asChild
                  variant="outline"
                  className="h-auto min-h-[64px] justify-start text-left whitespace-normal"
                >
                  <Link to={l.to} className="block p-3">
                    <div className="text-sm font-medium break-words">{l.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 break-words">
                      {l.description}
                    </div>
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

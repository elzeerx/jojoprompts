import { RefreshCw, ShieldAlert, Lock, ExternalLink, Sparkles, FileJson, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useMigrationPreview,
  useMigrationRehearsal,
  useMigrationVerification,
  type RehearsalResult,
  type MigrationVerificationResult,
} from "@/hooks/admin/v2/useAdminCommerce";
import { useLanguage } from "@/contexts/LanguageContext";

function fmtInt(n: unknown): string {
  const v = typeof n === "number" ? n : Number(n ?? 0);
  return Number.isFinite(v) ? v.toLocaleString("en-US") : "0";
}
function fmtFilsAsKwd(fils: unknown): string {
  const v = typeof fils === "number" ? fils : Number(fils ?? 0);
  if (!Number.isFinite(v)) return "—";
  return `${(v / 1000).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD`;
}

function Stat({ label, labelAr, value, hint }: { label: string; labelAr?: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">
        {label}{labelAr ? ` / ${labelAr}` : ""}
      </div>
      {/* Keep numeric tokens LTR even in RTL layout */}
      <div className="mt-1 text-lg font-semibold tabular-nums" dir="ltr">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground" dir="ltr">{hint}</div>}
    </div>
  );
}

function RehearsalCard() {
  const q = useMigrationRehearsal();
  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  if (q.isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Rehearsal error: {(q.error as Error).message}
      </div>
    );
  }
  const r = (q.data ?? {}) as Partial<RehearsalResult>;
  const pw = r.planned_writes ?? ({} as Partial<RehearsalResult["planned_writes"]>);
  const ew = r.existing_writes ?? ({} as Partial<RehearsalResult["existing_writes"]>);
  const pend = r.pending_writes ?? ({} as Partial<RehearsalResult["pending_writes"]>);
  const ct = r.credit_totals ?? ({} as Partial<RehearsalResult["credit_totals"]>);
  const co = r.cohorts ?? ({} as Partial<RehearsalResult["cohorts"]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Migration rehearsal (read-only) · policy {r.policy_version ?? "—"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-[11px] text-muted-foreground" dir="ltr">
          {r.notes ?? ""} · execute_available = <code>false</code> ·{" "}
          private_executor_ready = <code>{String(r.private_executor_ready ?? false)}</code>
        </div>

        {/* Plan hashes */}
        <div className="rounded-md border p-3 text-xs" dir="ltr">
          <div className="font-semibold mb-1">Plan hashes</div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
            <div>Entitlements: <code className="text-[10px]">{r.entitlement_plan_hash ?? "—"}</code></div>
            <div>Credits: <code className="text-[10px]">{r.credit_plan_hash ?? "—"}</code></div>
            <div>Combined: <code className="text-[10px]">{r.combined_plan_hash ?? "—"}</code></div>
          </div>
          <div className="mt-1 text-muted-foreground">
            Confirmation phrase required: <code>{r.confirmation_phrase_required ?? "—"}</code>. Execution requires
            explicit database approval — no public executor is exposed.
          </div>
        </div>

        {/* Planned entitlement writes */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Planned lifetime users"
            value={fmtInt(pw.entitlement_lifetime_users)}
            hint={`Premium ${fmtInt(pw.entitlement_premium_rows)} · Ultimate ${fmtInt(pw.entitlement_ultimate_rows)}`}
          />
          <Stat
            label="Standard active users"
            value={fmtInt(pw.entitlement_standard_users)}
            hint={`${fmtInt(pw.entitlement_standard_grants)} collection grants`}
          />
          <Stat
            label="Basic effective users"
            value={fmtInt(pw.entitlement_basic_users)}
            hint={`${fmtInt(pw.entitlement_basic_grants)} collection grants`}
          />
          <Stat
            label="Unique active users total"
            value={fmtInt(pw.entitlement_unique_users)}
            hint={`${fmtInt(pw.entitlement_rows_total)} entitlement rows`}
          />
          <Stat label="Historical expired Basic" value={fmtInt(co.historical_expired_basic_users)} hint="positive-status expired only" />
          <Stat label="Historical expired Standard" value={fmtInt(co.historical_expired_standard_users)} />
          <Stat label="Cancelled lifetime unresolved" value={fmtInt(co.cancelled_lifetime_unresolved_users)} />
        </div>

        {/* Credit totals */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3 text-xs" dir="ltr">
            <div className="font-semibold mb-1">PayPal verified</div>
            <div>Users: <strong className="tabular-nums">{fmtInt(pw.credit_paypal_users)}</strong></div>
            <div>Rows: <strong className="tabular-nums">{fmtInt(pw.credit_paypal_rows)}</strong></div>
            <div>Raw total: <strong className="tabular-nums">{fmtInt(ct.paypal_raw_fils)}</strong> fils</div>
            <div>Capped total: <strong className="tabular-nums">{fmtInt(ct.paypal_capped_fils)}</strong> fils</div>
          </div>
          <div className="rounded-md border p-3 text-xs" dir="ltr">
            <div className="font-semibold mb-1">UPayments verified (code-reconstructed KWD)</div>
            <div>Users: <strong className="tabular-nums">{fmtInt(pw.credit_upayments_users)}</strong></div>
            <div>Rows: <strong className="tabular-nums">{fmtInt(pw.credit_upayments_rows)}</strong></div>
            <div>Raw total: <strong className="tabular-nums">{fmtInt(ct.upayments_raw_fils)}</strong> fils</div>
            <div>Capped total: <strong className="tabular-nums">{fmtInt(ct.upayments_capped_fils)}</strong> fils</div>
          </div>
          <div className="rounded-md border p-3 text-xs" dir="ltr">
            <div className="font-semibold mb-1">Combined (per-user capped)</div>
            <div>Users: <strong className="tabular-nums">{fmtInt(ct.combined_users)}</strong></div>
            <div>Total: <strong className="tabular-nums">{fmtInt(ct.combined_capped_fils)}</strong> fils</div>
            <div className="mt-2">Threshold reached: <strong className="tabular-nums">{fmtInt(ct.users_reaching_threshold)}</strong></div>
            <div>Needing new lifetime grant: <strong className="tabular-nums">{fmtInt(pend.threshold_lifetime_grants_needed_now)}</strong></div>
          </div>
        </div>

        {/* Pending vs existing writes / replay conflicts */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-md border p-3 text-xs" dir="ltr">
            <div className="font-semibold mb-1">Pending writes (idempotent)</div>
            <div>Entitlements to insert: <strong className="tabular-nums">{fmtInt(pend.entitlements_to_insert)}</strong> (of {fmtInt(pw.entitlement_rows_total)} planned)</div>
            <div>Credit entries to insert: <strong className="tabular-nums">{fmtInt(pend.credit_entries_to_insert)}</strong> (of {fmtInt(pw.credit_rows_total)} planned)</div>
            <div>Threshold lifetime grants needed now: <strong className="tabular-nums">{fmtInt(pend.threshold_lifetime_grants_needed_now)}</strong></div>
          </div>
          <div className="rounded-md border p-3 text-xs" dir="ltr">
            <div className="font-semibold mb-1">Existing / replay conflicts</div>
            <div>Grants with a legacy_source (all history): <strong className="tabular-nums">{fmtInt(ew.entitlements_with_legacy_source)}</strong></div>
            <div>Credit entries with a legacy_transaction_id: <strong className="tabular-nums">{fmtInt(ew.credit_entries_with_legacy_transaction_id)}</strong></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Phase 6B.3 — Post-migration verification card (read-only, admin-only)
// ---------------------------------------------------------------------------
function VerificationRow({
  label,
  expected,
  actual,
  hint,
}: {
  label: string;
  expected: number | undefined;
  actual: number | undefined;
  hint?: string;
}) {
  const e = Number.isFinite(Number(expected)) ? Number(expected) : null;
  const a = Number.isFinite(Number(actual)) ? Number(actual) : null;
  const inSync = e !== null && a !== null && e === a;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border p-3 text-xs" dir="ltr">
      <div className="min-w-0">
        <div className="font-semibold break-words">{label}</div>
        {hint ? <div className="text-[11px] text-muted-foreground break-words">{hint}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 tabular-nums">
        <span>expected <strong>{e === null ? "—" : fmtInt(e)}</strong></span>
        <span>actual <strong>{a === null ? "—" : fmtInt(a)}</strong></span>
        <Badge variant={inSync ? "secondary" : "destructive"}>{inSync ? "in sync" : "drift"}</Badge>
      </div>
    </div>
  );
}

function DriftSummary({
  title,
  block,
}: {
  title: string;
  block: MigrationVerificationResult["drift"]["entitlements"] | undefined;
}) {
  const missing = Number(block?.missing_total ?? 0);
  const extra = Number(block?.extra_total ?? 0);
  const mism = Number(block?.mismatched_total ?? 0);
  const total = missing + extra + mism;
  const samples = (block?.missing_sample ?? []).concat(block?.extra_sample ?? [], block?.mismatched_sample ?? []);
  return (
    <div className="rounded-md border p-3 text-xs" dir="ltr">
      <div className="mb-1 flex items-center justify-between">
        <div className="font-semibold">{title}</div>
        <Badge variant={total === 0 ? "secondary" : "destructive"}>
          {total === 0 ? "No drift" : `${fmtInt(total)} drift`}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
        <div>Missing: <strong className="tabular-nums text-foreground">{fmtInt(missing)}</strong></div>
        <div>Extra: <strong className="tabular-nums text-foreground">{fmtInt(extra)}</strong></div>
        <div>Mismatched: <strong className="tabular-nums text-foreground">{fmtInt(mism)}</strong></div>
      </div>
      {total > 0 && samples.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] text-muted-foreground">Show first {samples.length} samples</summary>
          <pre className="mt-2 max-h-56 overflow-auto rounded bg-muted p-2 text-[10px]">
            {JSON.stringify(samples, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function VerificationCard() {
  const q = useMigrationVerification();

  if (q.isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Post-migration verification</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }

  if (q.isError) {
    const msg = q.error instanceof Error ? q.error.message : String(q.error ?? "unknown error");
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Post-migration verification</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" dir="ltr">
            Verification error: {msg}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 min-h-[44px] sm:min-h-[36px]"
            onClick={() => q.refetch()}
          >
            <RefreshCw className="me-1.5 h-3.5 w-3.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const r = (q.data ?? {}) as Partial<MigrationVerificationResult>;
  const expected = r.expected ?? ({} as Partial<MigrationVerificationResult["expected"]>);
  const actual = r.actual ?? ({} as Partial<MigrationVerificationResult["actual"]>);
  const drift = r.drift ?? ({} as Partial<MigrationVerificationResult["drift"]>);
  const audit = r.audit_event ?? ({} as Partial<MigrationVerificationResult["audit_event"]>);
  const hashes = r.plan_hashes ?? ({} as Partial<MigrationVerificationResult["plan_hashes"]>);
  const extras = r.executor_extras ?? ({} as Partial<MigrationVerificationResult["executor_extras"]>);
  const hashesMatch = r.hashes_match ?? "not_persisted";

  const totalDrift = Number(drift.total_drift ?? 0);
  const globalInSync = totalDrift === 0
    && Number(expected.entitlement_rows ?? -1) === Number(actual.entitlement_rows ?? -2)
    && Number(expected.credit_rows ?? -1) === Number(actual.credit_rows ?? -2);

  const notRun = !audit.id;

  const hashBadgeVariant: "secondary" | "destructive" | "outline" =
    hashesMatch === "match" ? "secondary"
    : hashesMatch === "mismatch" ? "destructive"
    : "outline";

  const checkedAt = r.checked_at ? new Date(r.checked_at) : null;
  const executedAt = audit.executed_at ? new Date(audit.executed_at) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Post-migration verification · policy {r.policy_version ?? "6B.2-r1"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground" dir="ltr">
          <Badge variant={globalInSync ? "secondary" : "destructive"}>
            {globalInSync ? "In sync" : "Drift detected"}
          </Badge>
          <Badge variant={hashBadgeVariant}>
            hashes: {hashesMatch}
          </Badge>
          <span>checked_at: {checkedAt ? checkedAt.toISOString() : "—"}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto min-h-[44px] sm:min-h-[32px]"
            onClick={() => q.refetch()}
            aria-label="Recheck verification"
          >
            <RefreshCw className="me-1.5 h-3.5 w-3.5" /> Recheck
          </Button>
        </div>

        {notRun ? (
          <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs" dir="ltr">
            No <code>v2_legacy_migration_executed</code> audit event was found. The migration has not
            been executed on this database yet, or the audit event was not persisted.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3">
          <VerificationRow
            label="Entitlement rows (grant_reason=legacy_migration)"
            expected={expected.entitlement_rows}
            actual={actual.entitlement_rows}
            hint="Deterministic plan vs public.entitlements (legacy_source IS NOT NULL)"
          />
          <VerificationRow
            label="Entitlement unique users"
            expected={expected.entitlement_unique_users}
            actual={actual.entitlement_unique_users}
          />
          <VerificationRow
            label="Credit entries (legacy_transaction_id linked)"
            expected={expected.credit_rows}
            actual={actual.credit_rows}
            hint="Deterministic plan vs public.lifetime_credit_entries"
          />
          <VerificationRow
            label="Credit unique users"
            expected={expected.credit_unique_users}
            actual={actual.credit_unique_users}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DriftSummary title="Entitlement drift" block={drift.entitlements} />
          <DriftSummary title="Credit drift" block={drift.credits} />
        </div>

        <div className="rounded-md border p-3 text-xs" dir="ltr">
          <div className="font-semibold mb-1">Plan hashes vs recorded execution</div>
          <div className="grid grid-cols-1 gap-1">
            <div>Current combined: <code className="text-[10px]">{hashes.combined_plan_hash ?? "—"}</code></div>
            <div>
              Recorded combined: {audit.combined_plan_hash
                ? <code className="text-[10px]">{audit.combined_plan_hash}</code>
                : <span className="text-muted-foreground">not_persisted</span>}
            </div>
            <div>Current entitlement: <code className="text-[10px]">{hashes.entitlement_plan_hash ?? "—"}</code></div>
            <div>Current credit: <code className="text-[10px]">{hashes.credit_plan_hash ?? "—"}</code></div>
          </div>
        </div>

        <div className="rounded-md border p-3 text-xs" dir="ltr">
          <div className="font-semibold mb-1">Recorded migration audit event</div>
          <div>Event id: <code className="text-[10px]">{audit.id ?? "—"}</code></div>
          <div>Executed at: {executedAt ? executedAt.toISOString() : "—"}</div>
          <div>Actor user id: <code className="text-[10px]">{audit.actor_user_id ?? "system"}</code></div>
          <div className="mt-2 text-muted-foreground">
            Active threshold grants: <strong className="tabular-nums text-foreground">
              {fmtInt(extras.active_lifetime_threshold_grants)}
            </strong>
            {" · "}Legacy_source rows (all history): <strong className="tabular-nums text-foreground">
              {fmtInt(extras.entitlements_with_any_legacy_source_all_history)}
            </strong>
            {" · "}Credit rows linked: <strong className="tabular-nums text-foreground">
              {fmtInt(extras.credit_entries_with_legacy_transaction_id)}
            </strong>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LegacyMigrationPreview() {
  const q = useMigrationPreview();
  const { dir } = useLanguage();

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Error / خطأ: {(q.error as Error).message}
      </div>
    );
  }

  const d = q.data!;
  const upay = d.transactions_upayments;
  const paypal = d.transactions_paypal;
  const ents = d.proposed_entitlements;
  const anom = d.anomalies;
  const cohorts = d.plan_cohorts;
  const policy = d.grandfathering_policy;

  return (
    <TooltipProvider>
      {/* Layout direction follows app language; numeric/technical values stay LTR via inner dir="ltr". */}
      <div className="space-y-6" dir={dir}>
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link
                to="/admin/publishing/imports"
                className="inline-flex min-h-[44px] items-center rounded-md px-2 py-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft className="me-1 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                Imports
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground">
              Legacy migration verification
            </li>
          </ol>
        </nav>

        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Legacy migration verification / التحقّق من الترحيل القديم
            </h1>
            <p className="text-sm text-muted-foreground">
              Read-only reconciliation. No customer entitlements, credits, or V1 data are changed by opening this page.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="min-h-[44px] min-w-[44px]">
              <Link
                to="/admin/publishing/imports"
                data-legacy-back-to-imports
                aria-label="Back to Imports / العودة إلى الاستيراد"
              >
                <ChevronLeft className="me-1.5 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                Back to Imports / العودة إلى الاستيراد
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/admin/publishing/imports/json"><FileJson className="me-1.5 h-4 w-4" /> JSON Importer</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/admin/publishing/imports/ai-studio"><Sparkles className="me-1.5 h-4 w-4" /> AI Studio</Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="min-h-[44px] min-w-[44px]"
              onClick={() => q.refetch()}
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>


        {/* Execution status banner */}
        <Card className="border-warning bg-warning/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-warning-foreground" />
              <div className="text-sm">
                <div className="font-medium">
                  Execute migration is disabled / تنفيذ الترحيل معطّل
                </div>
                <div className="text-muted-foreground" dir="ltr">
                  Fixed conversion rate: <strong>1 USD = {d.conversion_rate_fils_per_usd} fils</strong>. Per-user lifetime credit cap:{" "}
                  <strong>{fmtInt(d.threshold_fils)} fils</strong>. Blockers:{" "}
                  {d.execution_blockers.length === 0
                    ? "none — awaiting scope sign-off"
                    : d.execution_blockers.join(", ")}.
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  No <code>v2_admin_execute_migration</code> function exists. Rehearsal below is read-only and computes
                  planning aggregates only. Production execution still requires explicit approval after rehearsal signoff.
                </div>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button disabled className="min-h-[44px]">
                    <Lock className="me-2 h-4 w-4" />
                    Execute migration
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                Intentionally disabled. No execution endpoint is exposed until an admin resolves the UPayments currency policy.
              </TooltipContent>
            </Tooltip>
          </CardContent>
        </Card>

        {/* Grandfathering policy — locked contract, per-user-deduplicated cohorts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Grandfathering policy / سياسة الحفاظ على الحقوق
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-xs text-muted-foreground" dir="ltr">
              Policy version <code>{policy.version}</code>. Lifetime threshold{" "}
              <strong>{fmtInt(policy.lifetime_threshold_fils)}</strong> fils ({policy.lifetime_threshold_kwd} KWD).
              1 USD = <strong>{policy.conversion_rate_fils_per_usd}</strong> fils.
            </div>

            <div className="overflow-x-auto" dir="ltr">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Original promise</TableHead>
                    <TableHead>Proposed V2 scope</TableHead>
                    <TableHead>Expiry treatment</TableHead>
                    <TableHead>Cohort (raw source rows · unresolved users after dedupe)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policy.plans.map((p) => {
                    const users =
                      p.plan === "ultimate"
                        ? `${fmtInt(cohorts.ultimate_active_lifetime_users)} active · ${fmtInt(cohorts.ultimate_cancelled_source_rows ?? cohorts.ultimate_cancelled_review_users)} cancelled source rows · ${fmtInt(cohorts.ultimate_cancelled_unresolved_users ?? cohorts.ultimate_cancelled_review_users)} unresolved after valid-active dedupe`
                        : p.plan === "premium"
                          ? `${fmtInt(cohorts.premium_active_lifetime_users)} active · ${fmtInt(cohorts.premium_cancelled_source_rows ?? cohorts.premium_cancelled_review_users)} cancelled source rows · ${fmtInt(cohorts.premium_cancelled_unresolved_users ?? cohorts.premium_cancelled_review_users)} unresolved after valid-active dedupe`
                          : p.plan === "standard"
                            ? `${fmtInt(cohorts.standard_active_users)} active · ${fmtInt(cohorts.standard_expired_historical_users)} expired · ${fmtInt(cohorts.standard_cancelled_source_rows ?? cohorts.standard_cancelled_review_users)} cancelled source rows · ${fmtInt(cohorts.standard_cancelled_unresolved_users ?? cohorts.standard_cancelled_review_users)} unresolved after dedupe`
                            : `${fmtInt(cohorts.basic_active_users)} active · ${fmtInt(cohorts.basic_expired_historical_users)} expired · ${fmtInt(cohorts.basic_cancelled_source_rows ?? cohorts.basic_cancelled_review_users)} cancelled source rows · ${fmtInt(cohorts.basic_cancelled_unresolved_users ?? cohorts.basic_cancelled_review_users)} unresolved after dedupe`;
                    return (
                      <TableRow key={p.plan}>
                        <TableCell><Badge variant="outline" className="capitalize">{p.plan}</Badge></TableCell>
                        <TableCell className="tabular-nums">${p.price_usd} · {p.duration}</TableCell>
                        <TableCell className="text-xs">{p.original_promise}</TableCell>
                        <TableCell className="text-xs"><code>{p.proposed_v2_scope}</code></TableCell>
                        <TableCell className="text-xs">{p.expiry_treatment}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{users}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="mt-2 text-[11px] text-muted-foreground">
                "Cancelled source rows" is the raw count of cancelled/refunded subscription rows. "Unresolved after
                dedupe" excludes users who already hold a valid active superseding record (lifetime supersedes all;
                Standard supersedes Basic). The active row itself remains grantable; only the cancelled row is held for review.
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3 text-xs" dir="ltr">
                <div className="font-semibold mb-1">Lifetime library includes</div>
                <ul className="list-disc ps-4 space-y-0.5 text-muted-foreground">
                  {policy.library_scope_includes.map((x) => <li key={x}>{x.split("_").join(" ")}</li>)}
                </ul>
              </div>
              <div className="rounded-md border p-3 text-xs" dir="ltr">
                <div className="font-semibold mb-1">Excluded from lifetime library</div>
                <ul className="list-disc ps-4 space-y-0.5 text-muted-foreground">
                  {policy.library_scope_excludes.map((x) => <li key={x}>{x.split("_").join(" ")}</li>)}
                </ul>
              </div>
            </div>

            <div className="rounded-md border p-3 text-xs" dir="ltr">
              <div className="font-semibold mb-1">Lifetime credit rules</div>
              <ul className="space-y-1 text-muted-foreground">
                {Object.entries(policy.lifetime_credit_rules).map(([k, v]) => (
                  <li key={k}><code className="text-[10px]">{k}</code> — {v}</li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <div className="font-semibold mb-1">Customer copy (EN)</div>
                <ul className="space-y-1 text-muted-foreground">
                  {Object.entries(policy.copy.en).map(([k, v]) => (
                    <li key={k}><strong className="capitalize">{k}:</strong> {v}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs" dir="rtl">
                <div className="font-semibold mb-1">نسخة العميل (AR)</div>
                <ul className="space-y-1 text-muted-foreground">
                  {Object.entries(policy.copy.ar).map(([k, v]) => (
                    <li key={k}><strong>{k}:</strong> {v}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground" dir="ltr">
              Active definition: <code>{policy.active_definition}</code>. Expired: <code>{policy.expired_definition}</code>.
              Cancelled: {policy.cancelled_treatment}.
            </div>
          </CardContent>
        </Card>

        {/* Catalog reconciliation */}

        <Card>
          <CardHeader><CardTitle className="text-base">Catalog / الفهرس</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Legacy prompts" labelAr="ملاحظات قديمة" value={fmtInt(d.catalog.legacy_prompt_count)} />
            <Stat label="Matched V2 resources" labelAr="موارد مطابقة" value={fmtInt(d.catalog.matched_resource_count)} />
            <Stat label="Legacy versions" value={fmtInt(d.catalog.legacy_version_count)} />
            <Stat label="Legacy products" value={fmtInt(d.catalog.legacy_product_count)} />
            <Stat label="Unmatched legacy" value={fmtInt(d.catalog.unmatched_legacy_prompt_count)} />
          </CardContent>
        </Card>

        {/* Collections */}
        <Card>
          <CardHeader><CardTitle className="text-base">Collection classification / تصنيف المجموعات</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="ChatGPT prompts" labelAr="مجموعة ChatGPT" value={fmtInt(d.collections.chatgpt_prompts)} />
            <Stat label="Midjourney prompts" labelAr="مجموعة Midjourney" value={fmtInt(d.collections.midjourney_prompts)} />
            <Stat
              label="Unmatched / ambiguous"
              labelAr="غير مطابق"
              value={fmtInt(d.collections.unmatched_or_ambiguous)}
              hint="These will NOT be included in any collection grant — review required."
            />
          </CardContent>
        </Card>

        {/* Unmatched sample */}
        {d.unmatched_sample.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Unmatched sample (first 25)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto" dir="ltr">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slug</TableHead>
                      <TableHead>Resource type</TableHead>
                      <TableHead>Legacy prompt_type</TableHead>
                      <TableHead>Resource ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.unmatched_sample.map((r) => (
                      <TableRow key={r.resource_id}>
                        <TableCell className="text-xs">{r.slug}</TableCell>
                        <TableCell><Badge variant="outline">{r.resource_type}</Badge></TableCell>
                        <TableCell className="text-xs">{r.legacy_prompt_type ?? "—"}</TableCell>
                        <TableCell className="font-mono text-[11px]">{r.resource_id.slice(0, 8)}…</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscriptions */}
        <Card>
          <CardHeader><CardTitle className="text-base">Legacy subscriptions / الاشتراكات القديمة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <Stat label="Total subscriptions" value={fmtInt(d.subscriptions.total_subscriptions)} />
              <Stat label="Distinct users" value={fmtInt(d.subscriptions.distinct_users)} />
            </div>
            <div className="overflow-x-auto" dir="ltr">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead>Lifetime</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Expired</TableHead>
                    <TableHead>Active/Perpetual</TableHead>
                    <TableHead>Proposed scope</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.subscriptions.rows.map((r, i) => (
                    <TableRow key={`${r.tier}-${r.status}-${i}`}>
                      <TableCell><Badge variant="outline">{r.tier}</Badge></TableCell>
                      <TableCell>{r.is_lifetime ? "Yes" : "No"}</TableCell>
                      <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                      <TableCell className="tabular-nums">{fmtInt(r.count)}</TableCell>
                      <TableCell className="tabular-nums">{fmtInt(r.expired)}</TableCell>
                      <TableCell className="tabular-nums">{fmtInt(r.active_or_perpetual)}</TableCell>
                      <TableCell>
                        <Badge variant={r.proposed_scope === "no_grant_review" ? "destructive" : "default"}>
                          {r.proposed_scope}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {d.subscriptions.rows.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="h-16 text-center text-sm text-muted-foreground">No legacy subscriptions</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* PayPal */}
        <Card>
          <CardHeader><CardTitle className="text-base">PayPal transactions ({paypal.classification})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {paypal.rounding}. Per-user cap: <strong>{fmtInt(paypal.per_user_cap_fils)}</strong> fils.
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total" value={fmtInt(paypal.total_count)} />
              <Stat label="Positive completed" value={fmtInt(paypal.positive_completed_rows ?? 0)} />
              <Stat label="Strict verified rows" value={fmtInt(paypal.verified_rows ?? 0)} hint="linked positive-status sub, no negative link" />
              <Stat label="Verified users" value={fmtInt(paypal.verified_users ?? 0)} />
              <Stat label="Verified capped total" value={fmtInt(paypal.verified_total_capped_fils ?? 0)} hint={`≈ ${fmtFilsAsKwd(paypal.verified_total_capped_fils ?? 0)}`} />
              <Stat label="Users capped @ threshold" value={fmtInt(paypal.verified_users_capped_at_threshold ?? 0)} />
              <Stat label="Unlinked review rows" value={fmtInt(paypal.unlinked_positive_review_rows ?? 0)} hint="excluded from credit" />
              <Stat label="Negative-linked review rows" value={fmtInt(paypal.negative_linked_review_rows ?? 0)} hint="excluded from credit" />
              <Stat label="Zero amount" value={fmtInt(paypal.zero_amount_count)} />
              <Stat label="Duplicate provider refs" value={fmtInt(paypal.duplicate_provider_reference_groups)} />
            </div>
            <div className="overflow-x-auto" dir="ltr">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>USD total</TableHead>
                    <TableHead>fils total</TableHead>
                    <TableHead>Equivalent KWD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(paypal.by_status ?? []).map((r) => (
                    <TableRow key={r.status}>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                      <TableCell className="tabular-nums">{fmtInt(r.n)}</TableCell>
                      <TableCell className="tabular-nums">{Number(r.usd_total ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell className="tabular-nums">{fmtInt(r.fils_total)}</TableCell>
                      <TableCell className="tabular-nums">{fmtFilsAsKwd(r.fils_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-xs" dir="ltr">
              Strict verified pre-cap total:{" "}
              <strong>{fmtInt(paypal.proposed_credit_fils_completed_precap)}</strong> fils
              {" · "}{fmtFilsAsKwd(paypal.proposed_credit_fils_completed_precap)}. Unlinked and negative-linked
              positive-completed rows are held for manual review and excluded from the lifetime-credit totals.
            </div>
          </CardContent>
        </Card>

        {/* UPayments — code-reconstructed KWD */}
        <Card>
          <CardHeader><CardTitle className="text-base">UPayments transactions — code-reconstructed KWD</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 text-xs" dir="ltr">
              {upay.note} Base fils per plan: basic {fmtInt(upay.base_fils_by_tier.basic)}, standard{" "}
              {fmtInt(upay.base_fils_by_tier.standard)}, premium {fmtInt(upay.base_fils_by_tier.premium)}, ultimate{" "}
              {fmtInt(upay.base_fils_by_tier.ultimate)}.
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total" value={fmtInt(upay.total_count)} />
              <Stat label="Completed" value={fmtInt(upay.completed_count)} />
              <Stat label="Pending excluded" value={fmtInt(upay.pending_excluded_count)} />
              <Stat label="KWD completed" value={fmtInt(upay.kwd_completed_count)} />
              <Stat label="Strict verified rows" value={fmtInt(upay.strict_verified_rows)} hint="reconstructable + strict linkage" />
              <Stat label="Strict verified users" value={fmtInt(upay.strict_verified_users)} />
              <Stat
                label="Strict verified capped total"
                value={fmtInt(upay.strict_verified_total_capped_fils)}
                hint={`≈ ${fmtFilsAsKwd(upay.strict_verified_total_capped_fils)} · code-reconstructed KWD`}
              />
              <Stat label="Negative-linked review rows" value={fmtInt(upay.negative_linked_review_rows)} />
              <Stat label="Unlinked review rows" value={fmtInt(upay.unlinked_review_rows)} />
              <Stat label="Duplicate provider refs" value={fmtInt(upay.duplicate_provider_reference_groups)} />
            </div>
          </CardContent>
        </Card>

        {/* Combined verified legacy credit */}
        <Card>
          <CardHeader><CardTitle className="text-base">Combined verified legacy credit (PayPal + UPayments)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Users with credit" value={fmtInt(d.combined_legacy_credit.users_with_credit)} />
            <Stat
              label="Total capped credit"
              value={fmtInt(d.combined_legacy_credit.total_credit_fils)}
              hint={`≈ ${fmtFilsAsKwd(d.combined_legacy_credit.total_credit_fils)}`}
            />
            <Stat label="Users capped @ threshold" value={fmtInt(d.combined_legacy_credit.users_capped_at_threshold)} />
            <Stat label="Threshold" value={fmtInt(d.combined_legacy_credit.threshold_fils)} hint="fils" />
          </CardContent>
        </Card>

        <RehearsalCard />

        <VerificationCard />


        {/* Proposed entitlements + credit */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Proposed entitlements</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Active total" value={fmtInt(ents.active_total)} />
                <Stat label="Expired total" value={fmtInt(ents.expired_total)} hint="historical only, not granted" />
                <Stat label="Unique users (active)" value={fmtInt(ents.unique_users_active)} />
                <Stat label="Unique users (expired)" value={fmtInt(ents.unique_users_expired)} />
                <Stat
                  label="Cancelled lifetime — flagged"
                  value={fmtInt(ents.cancelled_lifetime_flagged_users)}
                  hint="no automatic grant"
                />
              </div>
              <div className="rounded-md border p-3 text-xs" dir="ltr">
                <div className="font-semibold mb-1">By scope</div>
                <pre className="whitespace-pre-wrap">{JSON.stringify(ents.by_scope, null, 2)}</pre>
                <div className="font-semibold mt-2 mb-1">Active by collection key</div>
                <pre className="whitespace-pre-wrap">{JSON.stringify(ents.by_collection_key_active, null, 2)}</pre>
                <div className="font-semibold mt-2 mb-1">Expired by collection key</div>
                <pre className="whitespace-pre-wrap">{JSON.stringify(ents.by_collection_key_expired, null, 2)}</pre>
                <div className="font-semibold mt-2 mb-1">By source</div>
                <pre className="whitespace-pre-wrap">{JSON.stringify(ents.by_source, null, 2)}</pre>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Proposed lifetime credit (PayPal only)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground">{d.proposed_lifetime_credit.source}</div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Users with credit" value={fmtInt(d.proposed_lifetime_credit.users_with_credit)} />
                <Stat label="Users capped @ threshold" value={fmtInt(d.proposed_lifetime_credit.users_capped_at_threshold)} />
                <Stat
                  label="Total credit"
                  value={fmtInt(d.proposed_lifetime_credit.total_credit_fils)}
                  hint={`≈ ${fmtFilsAsKwd(d.proposed_lifetime_credit.total_credit_fils)}`}
                />
                <Stat label="Threshold" value={fmtInt(d.proposed_lifetime_credit.threshold_fils)} hint="fils" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Anomalies */}
        <Card>
          <CardHeader><CardTitle className="text-base">Anomalies / تنبيهات (read-only)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Missing auth users (subs)" value={fmtInt(anom.missing_auth_users_for_subscriptions)} />
            <Stat label="Missing auth users (tx)" value={fmtInt(anom.missing_auth_users_for_transactions)} />
            <Stat label="Tx without subscription" value={fmtInt(anom.transactions_without_subscription)} />
            <Stat label="Subs without transaction" value={fmtInt(anom.subscriptions_without_transaction)} />
            <Stat label="Subs → missing tx" value={fmtInt(anom.subscriptions_with_missing_transaction)} />
            <Stat label="Subs without plan" value={fmtInt(anom.subscriptions_without_plan)} />
            <Stat label="Duplicate PayPal refs" value={fmtInt(anom.duplicate_paypal_reference_groups)} />
            <Stat label="Duplicate UPayments refs" value={fmtInt(anom.duplicate_upayments_reference_groups)} />
            <Stat label="Zero-amount PayPal completed" value={fmtInt(anom.zero_amount_paypal_completed)} />
            <Stat label="Zero-amount UPayments completed" value={fmtInt(anom.zero_amount_upayments_completed)} />
            <Stat label="Unsupported currencies" value={fmtInt(anom.unsupported_currencies)} />
            <Stat label="Unsupported gateways" value={fmtInt(anom.unsupported_gateways)} />
            <Stat label="Completed but zero amount" value={fmtInt(anom.transactions_status_mismatch_completed_zero)} />
            <Stat label="Expired but status=active" value={fmtInt(anom.subscriptions_expired_but_status_active)} />
            <Stat label="Cancelled lifetime users" value={fmtInt(anom.cancelled_lifetime_users)} />
            <Stat label="Ambiguous UPayments rows" value={fmtInt(anom.ambiguous_upayments_amount_rows)} />
            <Stat label="Unmatched legacy prompts" value={fmtInt(anom.unmatched_legacy_prompts)} />
          </CardContent>
        </Card>

        {/* Grant/import contract */}
        <Card>
          <CardHeader><CardTitle className="text-base">Grant &amp; import contract (deferred)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground">{d.grant_contract.note}</div>
            <ul className="space-y-2 text-sm">
              {d.grant_contract.rules.map((r) => (
                <li key={r.rule} className="rounded-md border p-3">
                  <div className="font-semibold" dir="ltr"><code>{r.rule}</code></div>
                  <div className="text-xs text-muted-foreground mt-1">{r.detail}</div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/publishing/imports/json"><ExternalLink className="me-1.5 h-3.5 w-3.5" /> Legacy JSON Importer</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/publishing/imports/ai-studio"><ExternalLink className="me-1.5 h-3.5 w-3.5" /> AI Studio</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-xs text-muted-foreground" dir="ltr">
          Generated at {d.generated_at} · Read-only preview · No execution endpoint exposed.
        </div>
      </div>
    </TooltipProvider>
  );
}

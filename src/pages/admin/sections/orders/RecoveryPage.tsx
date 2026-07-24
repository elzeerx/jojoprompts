import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { RefreshCw, ExternalLink, ShieldAlert, ShieldCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useAdminRecovery, useAdminRecoveryCounts,
  useCheckPaymentStatus, useCheckRefundStatus,
  useReconciliationSummary, useReconcileOrder,
  useFinalizeDefiniteRefundRejection,
  type AdminRecoveryRow, type ReconciliationSummary, type OrderReconciliation,
} from "@/hooks/admin/v2/useAdminCommerce";
import { formatDateTime, formatAge, bi } from "@/lib/v2/admin/format";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const KINDS = [
  "charge_submission_unknown",
  "stale_payment_attempt",
  "refund_submission_unknown",
  "refund_awaiting_status",
  "refund_failed",
  "verification_rejection",
];

const SEVERITY_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "secondary", medium: "outline", high: "destructive",
};

const PAGE_SIZE = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INTEGRITY_METRIC_LABELS: Record<keyof Omit<ReconciliationSummary, "as_of">, string> = {
  mismatches: "Payment attempt mismatches",
  pending_past_due: "Pending attempts >2h",
  paid_without_entitlement: "Paid orders missing entitlement",
  credit_inconsistent: "Paid orders missing positive credit",
  duplicate_event_risk: "Duplicate payment events",
  refund_alloc_over_item: "Refund alloc > item paid",
  refund_alloc_over_order: "Refund total > order paid",
  processed_missing_credit: "Processed refunds missing negative credit",
  processed_item_unrevoked_entitlement: "Fully refunded items with active entitlement",
  threshold_lifetime_below_credit: "Threshold lifetime below credit",
};

export default function RecoveryPage() {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const kind = params.get("kind") ?? "";
  const severity = params.get("severity") ?? "";
  const minAge = parseInt(params.get("age") ?? "0", 10) || 0;
  const page = Math.max(parseInt(params.get("page") ?? "1", 10), 1);

  const list = useAdminRecovery({
    kind: kind || null,
    minAgeMinutes: minAge,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const counts = useAdminRecoveryCounts();
  const integrity = useReconciliationSummary();
  const checkPayment = useCheckPaymentStatus();
  const checkRefund = useCheckRefundStatus();
  const finalizeRejection = useFinalizeDefiniteRefundRejection();

  const [finalizeTarget, setFinalizeTarget] = useState<AdminRecoveryRow | null>(null);

  const filteredRows = useMemo(() => {
    const rows = list.data?.rows ?? [];
    return severity ? rows.filter((r) => r.severity === severity) : rows;
  }, [list.data, severity]);

  const totalPages = Math.max(1, Math.ceil((list.data?.total_count ?? 0) / PAGE_SIZE));

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  const runCheck = async (row: AdminRecoveryRow) => {
    try {
      // Refund re-check is only meaningful for refund_awaiting_status; the
      // recovery-row builder gates the button on this kind. For
      // charge_submission_unknown / stale_payment_attempt we re-check the
      // payment, never the refund.
      if (row.kind === "refund_awaiting_status" && row.refund_id) {
        await checkRefund.mutateAsync(row.refund_id);
      } else if (row.order_id) {
        await checkPayment.mutateAsync(row.order_id);
      } else return;
      toast({ description: "Verified provider status re-checked" });
    } catch (e) {
      const code = (e as Error)?.message ?? "unknown_error";
      if (code === "provider_disabled" || code === "configuration_unavailable") {
        toast({ variant: "destructive", description: "Payments unavailable — provider disabled" });
      } else if (code === "backoff_active" || code === "global_backoff") {
        toast({ variant: "destructive", description: "Backoff active — try again shortly" });
      } else {
        toast({ variant: "destructive", description: `Check failed: ${code}` });
      }
    }
  };

  const rowActions = (row: AdminRecoveryRow) => {
    const meta = (row.meta ?? {}) as Record<string, unknown>;
    const canRecheckPayment =
      (row.kind === "charge_submission_unknown" || row.kind === "stale_payment_attempt")
      && !!row.order_id;
    // Refund re-check requires the EXACT four pollability conditions the
    // provider poll endpoint needs: status=approved, submission_state=submitted,
    // and both provider identifiers present. Row visibility is intentionally
    // wider so ops can see stuck rows missing IDs, but the button stays off.
    const submissionState = typeof meta["submission_state"] === "string"
      ? (meta["submission_state"] as string) : null;
    const status = typeof meta["status"] === "string" ? (meta["status"] as string) : null;
    const providerReference = typeof meta["provider_reference"] === "string"
      && (meta["provider_reference"] as string).length > 0;
    const providerRefundOrderId = typeof meta["provider_refund_order_id"] === "string"
      && (meta["provider_refund_order_id"] as string).length > 0;
    const canRecheckRefund =
      row.kind === "refund_awaiting_status"
      && !!row.refund_id
      && status === "approved"
      && submissionState === "submitted"
      && providerReference
      && providerRefundOrderId;
    const canFinalize =
      row.kind === "refund_submission_unknown"
      && meta["can_finalize_definite_rejection"] === true
      && !!row.refund_id;

    return { meta, canRecheckPayment, canRecheckRefund, canFinalize };
  };

  return (
    <div className="space-y-4 sm:space-y-6" dir="ltr">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            Recovery / الإصلاح
          </h1>
          <p className="text-sm text-muted-foreground">
            Attention required — read-only. Actions are limited to verified provider re-checks,
            navigation, and admin-verified refund-rejection finalization. No mark-paid, no direct
            entitlement grants.
          </p>
        </div>
        <Button
          variant="outline" size="icon" className="min-h-[44px] min-w-[44px]"
          onClick={() => { list.refetch(); counts.refetch(); integrity.refetch(); }}
          aria-label="Refresh"
        ><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {/* Commerce integrity card */}
      <IntegritySection query={integrity} />

      {/* Order reconciliation panel */}
      <OrderReconciliationPanel />

      {/* Count summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {KINDS.map((k) => (
          <Card
            key={k}
            className={`cursor-pointer ${kind === k ? "ring-2 ring-primary" : ""}`}
            onClick={() => updateParam("kind", kind === k ? null : k)}
          >
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground truncate">{k.replace(/_/g, " ")}</div>
              <div className="text-lg font-semibold">
                {counts.isLoading ? <Skeleton className="h-5 w-8" /> : (counts.data?.by_kind[k] ?? 0)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={kind || "all"} onValueChange={(v) => updateParam("kind", v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-[220px] min-h-[44px]">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={severity || "all"} onValueChange={(v) => updateParam("severity", v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-[160px] min-h-[44px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any severity</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(minAge)} onValueChange={(v) => updateParam("age", v === "0" ? null : v)}>
          <SelectTrigger className="w-full sm:w-[160px] min-h-[44px]">
            <SelectValue placeholder="Min age" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any age</SelectItem>
            <SelectItem value="15">≥ 15 min</SelectItem>
            <SelectItem value="60">≥ 1 hour</SelectItem>
            <SelectItem value="240">≥ 4 hours</SelectItem>
            <SelectItem value="1440">≥ 1 day</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {list.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {bi("error")}: {(list.error as Error)?.message ?? "unknown"}
        </div>
      )}
      {list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : isMobile ? (
        <div className="space-y-2">
          {filteredRows.map((r, i) => {
            const a = rowActions(r);
            return (
              <Card key={`${r.kind}-${r.order_id ?? r.refund_id ?? i}`}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant={SEVERITY_TONE[r.severity]}>{r.severity}</Badge>
                    <span className="text-xs text-muted-foreground">{formatAge(r.age_seconds)}</span>
                  </div>
                  <div className="text-sm font-medium">{r.kind.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">{r.reason}</div>
                  <div className="text-xs">
                    Order: <span className="font-mono">{r.order_number ?? r.order_id?.slice(0, 8) ?? "—"}</span>
                  </div>
                  {(typeof a.meta["http_status"] === "number" || typeof a.meta["error_code"] === "string") && (
                    <div className="text-xs text-muted-foreground font-mono">
                      {typeof a.meta["http_status"] === "number" ? `HTTP ${a.meta["http_status"]} ` : ""}
                      {typeof a.meta["error_code"] === "string" ? `· ${a.meta["error_code"]}` : ""}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1 flex-wrap">
                    {(a.canRecheckPayment || a.canRecheckRefund) && (
                      <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => runCheck(r)}
                        disabled={checkPayment.isPending || checkRefund.isPending}>
                        Re-check
                      </Button>
                    )}
                    {a.canFinalize && (
                      <Button size="sm" variant="destructive" className="min-h-[44px]"
                        onClick={() => setFinalizeTarget(r)}>
                        Finalize rejection
                      </Button>
                    )}
                    {r.order_id && (
                      <Button size="sm" variant="ghost" className="min-h-[44px]" asChild>
                        <Link to={`/admin/orders?order=${r.order_id}`}>Open order</Link>
                      </Button>
                    )}
                    {r.refund_id && (
                      <Button size="sm" variant="ghost" className="min-h-[44px]" asChild>
                        <Link to={`/admin/orders/refunds?refund=${r.refund_id}`}>Open refund</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredRows.length === 0 && (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{bi("empty")}</div>
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-[320px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r, i) => {
                const a = rowActions(r);
                return (
                  <TableRow key={`${r.kind}-${r.order_id ?? r.refund_id ?? i}`}>
                    <TableCell><Badge variant={SEVERITY_TONE[r.severity]}>{r.severity}</Badge></TableCell>
                    <TableCell className="text-xs">{r.kind.replace(/_/g, " ")}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.order_number ?? r.order_id?.slice(0, 8) ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.user_email_masked ?? "—"}</TableCell>
                    <TableCell className="text-xs">{formatAge(r.age_seconds)}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {typeof a.meta["http_status"] === "number" ? `${a.meta["http_status"]}` : ""}
                      {typeof a.meta["error_code"] === "string" ? ` · ${a.meta["error_code"]}` : ""}
                      {formatDateTime(r.last_checked_at) && !a.meta["http_status"]
                        ? formatDateTime(r.last_checked_at) : ""}
                    </TableCell>
                    <TableCell className="text-xs max-w-[280px] truncate">{r.reason}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {(a.canRecheckPayment || a.canRecheckRefund) && (
                          <Button size="sm" variant="outline" className="min-h-[44px]"
                            onClick={() => runCheck(r)}
                            disabled={checkPayment.isPending || checkRefund.isPending}>
                            Re-check
                          </Button>
                        )}
                        {a.canFinalize && (
                          <Button size="sm" variant="destructive" className="min-h-[44px]"
                            onClick={() => setFinalizeTarget(r)}>
                            Finalize rejection
                          </Button>
                        )}
                        {r.order_id && (
                          <Button size="sm" variant="ghost" className="min-h-[44px]" asChild>
                            <Link to={`/admin/orders?order=${r.order_id}`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                        {r.refund_id && (
                          <Button size="sm" variant="ghost" className="min-h-[44px]" asChild>
                            <Link to={`/admin/orders/refunds?refund=${r.refund_id}`}>Refund</Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                    {bi("empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>{(list.data?.total_count ?? 0).toLocaleString()} results · Page {page} / {totalPages}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page <= 1}
            onClick={() => updateParam("page", String(page - 1))}>Prev</Button>
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page >= totalPages}
            onClick={() => updateParam("page", String(page + 1))}>Next</Button>
        </div>
      </div>

      <FinalizeRejectionDialog
        target={finalizeTarget}
        onOpenChange={(open) => { if (!open) setFinalizeTarget(null); }}
        onConfirm={async () => {
          if (!finalizeTarget || !finalizeTarget.refund_id) return;
          const meta = (finalizeTarget.meta ?? {}) as Record<string, unknown>;
          const httpStatus = typeof meta["http_status"] === "number" ? meta["http_status"] as number : null;
          const code = typeof meta["error_code"] === "string" ? (meta["error_code"] as string).trim() : "";
          if (!httpStatus || !code) {
            toast({ variant: "destructive", description: "Missing verified HTTP status or provider code" });
            return;
          }
          try {
            const res = await finalizeRejection.mutateAsync({
              refund_id: finalizeTarget.refund_id,
              expected_http_status: httpStatus,
              expected_error_code: code,
            });
            toast({ description: res.noop ? "Already finalized (noop)" : "Refund finalized as failed" });
            setFinalizeTarget(null);
          } catch (e) {
            toast({ variant: "destructive",
              description: `Finalize failed: ${(e as Error)?.message ?? "unknown"}` });
          }
        }}
        pending={finalizeRejection.isPending}
      />
    </div>
  );
}

// -------------------------------------------------------------- integrity

function IntegritySection({
  query,
}: { query: ReturnType<typeof useReconciliationSummary> }) {
  const data = query.data;
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Commerce integrity / سلامة التجارة
        </CardTitle>
        <div className="flex items-center gap-2">
          {data?.as_of && (
            <span className="text-xs text-muted-foreground">{formatDateTime(data.as_of)}</span>
          )}
          <Button size="sm" variant="ghost" className="min-h-[44px]"
            onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : query.isError ? (
          <div className="text-sm text-destructive">
            {(query.error as Error)?.message ?? "unknown error"}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {(Object.keys(INTEGRITY_METRIC_LABELS) as Array<keyof typeof INTEGRITY_METRIC_LABELS>).map((k) => {
              const value = data[k] as number;
              const zero = value === 0;
              return (
                <div key={k}
                  className={`rounded-md border p-2 ${zero ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"}`}>
                  <div className="text-[11px] text-muted-foreground leading-tight">
                    {INTEGRITY_METRIC_LABELS[k]}
                  </div>
                  <div className={`text-lg font-semibold ${zero ? "text-emerald-600" : "text-destructive"}`}>
                    {value.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------- reconcile panel

function OrderReconciliationPanel() {
  const [input, setInput] = useState("");
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const recon = useReconcileOrder(resolvedId);

  const load = async () => {
    setResolveError(null);
    const trimmed = input.trim();
    if (!trimmed) return;
    if (UUID_RE.test(trimmed)) {
      setResolvedId(trimmed);
      return;
    }
    // Try order number via v2_admin_list_orders search
    setResolving(true);
    try {
      const { data, error } = await (supabase.rpc as any)("v2_admin_list_orders", {
        p_search: trimmed, p_limit: 5, p_offset: 0,
      });
      if (error) throw error;
      const rows = (data?.rows ?? []) as Array<{ id: string; order_number: string }>;
      const exact = rows.find((r) => r.order_number === trimmed) ?? rows[0];
      if (!exact) {
        setResolveError("No matching order");
        setResolvedId(null);
      } else {
        setResolvedId(exact.id);
      }
    } catch (e) {
      setResolveError((e as Error)?.message ?? "lookup failed");
      setResolvedId(null);
    } finally {
      setResolving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4" />
          Order reconciliation / مطابقة الطلب
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Order UUID or order number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
            className="min-h-[44px]"
          />
          <Button className="min-h-[44px]" onClick={load} disabled={resolving || !input.trim()}>
            {resolving ? "Loading…" : "Reconcile"}
          </Button>
        </div>
        {resolveError && <div className="text-sm text-destructive">{resolveError}</div>}
        {recon.isError && !recon.isLoading && (
          <div className="text-sm text-destructive">
            {(recon.error as Error)?.message ?? "reconcile failed"}
          </div>
        )}
        {recon.isLoading && resolvedId && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
          </div>
        )}
        {recon.data && <ReconciliationView data={recon.data} />}
      </CardContent>
    </Card>
  );
}

function ReconciliationView({ data }: { data: OrderReconciliation }) {
  const { order, counts, issues, healthy } = data;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={healthy ? "secondary" : "destructive"}>
          {healthy ? "Healthy" : `${issues.length} issue${issues.length === 1 ? "" : "s"}`}
        </Badge>
        <span className="font-mono text-xs">{order.order_number}</span>
        <Badge variant="outline">{order.status}</Badge>
        <Badge variant="outline">{order.provider ?? "—"}</Badge>
        <span className="text-xs text-muted-foreground">
          {(order.paid_fils / 1000).toFixed(3)} / {(order.total_fils / 1000).toFixed(3)} {order.currency}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
        {Object.entries(counts).map(([k, v]) => (
          <div key={k} className="rounded-md border p-2">
            <div className="text-muted-foreground leading-tight">{k.replace(/_/g, " ")}</div>
            <div className="font-mono">{typeof v === "number" ? v.toLocaleString() : String(v)}</div>
          </div>
        ))}
      </div>

      {issues.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
          <div className="text-sm font-semibold text-destructive">Issues</div>
          <ul className="space-y-1 text-xs">
            {issues.map((i, idx) => (
              <li key={idx} className="font-mono">
                <span className="text-destructive">{i.code}</span>
                <span className="text-muted-foreground"> · {i.severity}</span>
                {i.detail && Object.keys(i.detail).length > 0 && (
                  <span className="text-muted-foreground"> · {JSON.stringify(i.detail)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------- finalize dialog

function FinalizeRejectionDialog({
  target, onOpenChange, onConfirm, pending,
}: {
  target: AdminRecoveryRow | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const meta = (target?.meta ?? {}) as Record<string, unknown>;
  const httpStatus = typeof meta["http_status"] === "number" ? meta["http_status"] : null;
  const errorCode = typeof meta["error_code"] === "string" ? meta["error_code"] : null;
  const message = typeof meta["message"] === "string" ? meta["message"] : null;

  return (
    <AlertDialog open={!!target} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finalize refund rejection / إنهاء رفض الاسترداد</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                This marks the refund as terminally <strong>failed</strong> based on the
                provider's DEFINITE 4xx rejection. It does NOT revoke any entitlement, does
                NOT alter the paid order, and does NOT reverse lifetime credit.
              </p>
              <div className="rounded-md border p-2 font-mono text-xs space-y-1">
                <div>Order: {target?.order_number ?? target?.order_id?.slice(0, 8) ?? "—"}</div>
                <div>Refund: {target?.refund_id?.slice(0, 8) ?? "—"}</div>
                <div>HTTP status: {httpStatus ?? "—"}</div>
                <div>Provider code: {errorCode ?? "—"}</div>
                {message && <div>Message: {message}</div>}
              </div>
              <p className="text-muted-foreground text-xs">
                Only proceed if you have externally verified via GET /check-refund/{"{orderId}"}
                that no provider refund exists. Do NOT use for network errors, timeouts, or 5xx.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={pending || !httpStatus || !errorCode}
          >
            {pending ? "Finalizing…" : "Finalize as failed"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

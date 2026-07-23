import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { RefreshCw, ExternalLink, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useAdminRecovery, useAdminRecoveryCounts,
  useCheckPaymentStatus, useCheckRefundStatus,
} from "@/hooks/admin/v2/useAdminCommerce";
import { formatDateTime, formatAge, bi } from "@/lib/v2/admin/format";
import { toast } from "@/hooks/use-toast";

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
  const checkPayment = useCheckPaymentStatus();
  const checkRefund = useCheckRefundStatus();

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

  const runCheck = async (row: (typeof filteredRows)[number]) => {
    try {
      if (row.refund_id) {
        await checkRefund.mutateAsync(row.refund_id);
      } else if (row.order_id) {
        await checkPayment.mutateAsync(row.order_id);
      }
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

  return (
    <div className="space-y-4 sm:space-y-6" dir="ltr">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            Recovery / الإصلاح
          </h1>
          <p className="text-sm text-muted-foreground">
            Attention required — read-only. Actions are limited to verified provider re-checks and
            navigation. No mark-paid, no direct entitlement grants.
          </p>
        </div>
        <Button
          variant="outline" size="icon" className="min-h-[44px] min-w-[44px]"
          onClick={() => { list.refetch(); counts.refetch(); }}
          aria-label="Refresh"
        ><RefreshCw className="h-4 w-4" /></Button>
      </div>

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
          {filteredRows.map((r, i) => (
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
                <div className="flex gap-2 pt-1">
                  {(r.refund_id || r.order_id) && (
                    <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => runCheck(r)}
                      disabled={checkPayment.isPending || checkRefund.isPending}>
                      Re-check
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
          ))}
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
                <TableHead>Last checked</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-[280px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r, i) => (
                <TableRow key={`${r.kind}-${r.order_id ?? r.refund_id ?? i}`}>
                  <TableCell><Badge variant={SEVERITY_TONE[r.severity]}>{r.severity}</Badge></TableCell>
                  <TableCell className="text-xs">{r.kind.replace(/_/g, " ")}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.order_number ?? r.order_id?.slice(0, 8) ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">{r.user_email_masked ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatAge(r.age_seconds)}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(r.last_checked_at)}</TableCell>
                  <TableCell className="text-xs max-w-[280px] truncate">{r.reason}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(r.refund_id || r.order_id) && (
                        <Button size="sm" variant="outline" className="min-h-[44px]"
                          onClick={() => runCheck(r)}
                          disabled={checkPayment.isPending || checkRefund.isPending}>
                          Re-check
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
              ))}
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
    </div>
  );
}

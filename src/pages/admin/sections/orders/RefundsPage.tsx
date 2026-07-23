import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, RefreshCw, Copy, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAdminRefunds } from "@/hooks/admin/v2/useAdminCommerce";
import {
  formatFils, formatDateTime, statusTone, copyToClipboard, bi,
} from "@/lib/v2/admin/format";
import { RefundDetailSheet } from "./RefundDetailSheet";
import { CreateRefundDialog } from "./CreateRefundDialog";

const REFUND_STATUSES = ["pending", "approved", "processed", "failed", "cancelled"];
const PAGE_SIZE = 25;

export default function RefundsPage() {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();

  const status = params.get("status") ?? "";
  const search = params.get("q") ?? "";
  const page = Math.max(parseInt(params.get("page") ?? "1", 10), 1);
  const openRefundId = params.get("refund");
  const [searchInput, setSearchInput] = useState(search);
  const [createOpen, setCreateOpen] = useState(false);

  const refunds = useAdminRefunds({
    status: status || null,
    search: search || null,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil((refunds.data?.total_count ?? 0) / PAGE_SIZE));

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-4 sm:space-y-6" dir="ltr">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Refunds / المبالغ المستردة</h1>
          <p className="text-sm text-muted-foreground">
            Admin-created refunds go through the provider. Only a provider-verified processed
            refund revokes the corresponding entitlement and reverses lifetime credit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="min-h-[44px]" onClick={() => setCreateOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> New refund / استرداد جديد
          </Button>
          <Button
            variant="outline" size="icon" className="min-h-[44px] min-w-[44px]"
            onClick={() => refunds.refetch()} aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          onSubmit={(e) => { e.preventDefault(); updateParam("q", searchInput.trim() || null); }}
          className="flex flex-1 items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Order # · masked customer · provider ref"
              className="pl-9 min-h-[44px]"
            />
          </div>
          <Button type="submit" className="min-h-[44px]">{bi("search")}</Button>
        </form>
        <Select
          value={status || "all"}
          onValueChange={(v) => updateParam("status", v === "all" ? null : v)}
        >
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]">
            <SelectValue placeholder={bi("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {REFUND_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {refunds.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {bi("error")}: {(refunds.error as Error)?.message ?? "unknown"}
        </div>
      )}
      {refunds.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : isMobile ? (
        <div className="space-y-2">
          {(refunds.data?.rows ?? []).map((r) => (
            <Card key={r.id} className="cursor-pointer" onClick={() => updateParam("refund", r.id)}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-sm">{r.order_number ?? r.order_id.slice(0, 8)}</div>
                  <Badge variant={statusTone(r.status)}>{r.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{r.user_email_masked ?? "—"}</div>
                <div className="flex items-center justify-between text-sm">
                  <span>{formatFils(r.amount_fils)}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(r.requested_at)}</span>
                </div>
                {r.reason && <div className="text-xs text-muted-foreground truncate">{r.reason}</div>}
              </CardContent>
            </Card>
          ))}
          {(refunds.data?.rows.length ?? 0) === 0 && (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{bi("empty")}</div>
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submission</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(refunds.data?.rows ?? []).map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => updateParam("refund", r.id)}>
                  <TableCell className="font-mono text-xs">{r.order_number ?? r.order_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs">{r.user_email_masked ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatFils(r.amount_fils)}</TableCell>
                  <TableCell><Badge variant={statusTone(r.status)}>{r.status}</Badge></TableCell>
                  <TableCell className="text-xs">{r.provider_submission_state ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(r.requested_at)}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(r.processed_at)}</TableCell>
                  <TableCell className="text-xs max-w-[240px] truncate">{r.reason ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await copyToClipboard(r.id);
                        toast({ description: ok ? "Copied refund ID" : "Copy failed" });
                      }}
                      aria-label="Copy refund ID"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(refunds.data?.rows.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                    {bi("empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>{(refunds.data?.total_count ?? 0).toLocaleString()} results · Page {page} / {totalPages}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page <= 1}
            onClick={() => updateParam("page", String(page - 1))}>Prev</Button>
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page >= totalPages}
            onClick={() => updateParam("page", String(page + 1))}>Next</Button>
        </div>
      </div>

      <RefundDetailSheet
        refundId={openRefundId}
        onOpenChange={(open) => !open && updateParam("refund", null)}
      />
      <CreateRefundDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

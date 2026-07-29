import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, RefreshCw, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAdminMetrics, useAdminOrders } from "@/hooks/admin/v2/useAdminCommerce";
import { formatFils, formatDateTime, statusTone, copyToClipboard, bi } from "@/lib/v2/admin/format";
import { OrderDetailSheet } from "./OrderDetailSheet";

const ORDER_STATUSES = ["pending", "paid", "failed", "refunded", "partially_refunded", "cancelled"];
const PAGE_SIZE = 25;

export default function OrdersV2Page() {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();

  const status = params.get("status") ?? "";
  const search = params.get("q") ?? "";
  const period = parseInt(params.get("period") ?? "30", 10);
  const page = Math.max(parseInt(params.get("page") ?? "1", 10), 1);
  const openOrderId = params.get("order");

  const [searchInput, setSearchInput] = useState(search);

  const metrics = useAdminMetrics(period);
  const orders = useAdminOrders({
    status: status || null,
    search: search || null,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil((orders.data?.total_count ?? 0) / PAGE_SIZE));

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam("q", searchInput.trim() || null);
  };

  const kpis = useMemo(() => {
    const m = metrics.data;
    return [
      { label: "Revenue (KWD)", value: m ? formatFils(m.revenue_fils, { withCode: false }) : "—" },
      { label: "Paid orders", value: m?.orders_paid ?? "—" },
      { label: "Pending", value: m?.orders_pending ?? "—" },
      { label: "Failed", value: m?.orders_failed ?? "—" },
      { label: "Refunded", value: m?.orders_refunded ?? "—" },
      { label: "Refunds processed (KWD)", value: m ? formatFils(m.refunds_processed_fils, { withCode: false }) : "—" },
      { label: "Lifetime — direct", value: m?.lifetime_direct_unlocks ?? "—" },
      { label: "Lifetime — threshold", value: m?.lifetime_threshold_unlocks ?? "—" },
    ];
  }, [metrics.data]);

  return (
    <div className="space-y-4 sm:space-y-6" dir="ltr">
      {/* Header + period */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders / الطلبات</h1>
          <p className="text-sm text-muted-foreground">
            V2 commerce operations. Read-only ledger view — no permanent delete.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(period)} onValueChange={(v) => updateParam("period", v)}>
            <SelectTrigger className="w-[160px] min-h-[44px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 365 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="min-h-[44px] min-w-[44px]"
            onClick={() => {
              metrics.refetch();
              orders.refetch();
            }}
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {k.label}
              </div>
              <div className="mt-1 text-lg font-semibold">
                {metrics.isLoading ? <Skeleton className="h-5 w-16" /> : k.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form onSubmit={submitSearch} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search orders"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Order # · masked customer · provider ref"
              className="pl-9 min-h-[44px]"
            />
          </div>
          <Button type="submit" className="min-h-[44px]">
            {bi("search")}
          </Button>
        </form>
        <Select value={status || "all"} onValueChange={(v) => updateParam("status", v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]">
            <SelectValue placeholder={bi("status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {orders.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {bi("error")}: {(orders.error as Error)?.message ?? "unknown"}
        </div>
      )}
      {orders.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : isMobile ? (
        <div className="space-y-2">
          {(orders.data?.rows ?? []).map((o) => (
            <Card key={o.id} className="cursor-pointer" onClick={() => updateParam("order", o.id)}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-sm">{o.order_number}</div>
                  <Badge variant={statusTone(o.status)}>{o.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{o.user_email_masked ?? "—"}</div>
                <div className="flex items-center justify-between text-sm">
                  <span>{formatFils(o.total_fils)}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(o.created_at)}</span>
                </div>
                {o.attention && <Badge variant="destructive" className="text-[10px]">{o.attention}</Badge>}
              </CardContent>
            </Card>
          ))}
          {(orders.data?.rows.length ?? 0) === 0 && (
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
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Lifetime credit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Settled</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orders.data?.rows ?? []).map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => updateParam("order", o.id)}
                >
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      {o.order_number}
                      {o.attention && (
                        <Badge variant="destructive" className="text-[10px]">
                          {o.attention}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{o.user_email_masked ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatFils(o.total_fils)}</TableCell>
                  <TableCell className="text-xs">{formatFils(o.paid_fils)}</TableCell>
                  <TableCell className="text-xs">{formatFils(o.lifetime_credit_applied_fils)}</TableCell>
                  <TableCell><Badge variant={statusTone(o.status)}>{o.status}</Badge></TableCell>
                  <TableCell className="text-xs">{o.provider ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(o.created_at)}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(o.settled_at)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-[44px] min-w-[44px]"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await copyToClipboard(o.order_number);
                        toast({ description: ok ? "Copied order number" : "Copy failed" });
                      }}
                      aria-label="Copy order number"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(orders.data?.rows.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-sm text-muted-foreground">
                    {bi("empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          {(orders.data?.total_count ?? 0).toLocaleString()} results · Page {page} / {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={page <= 1}
            onClick={() => updateParam("page", String(page - 1))}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={page >= totalPages}
            onClick={() => updateParam("page", String(page + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <OrderDetailSheet
        orderId={openOrderId}
        onOpenChange={(open) => !open && updateParam("order", null)}
      />
    </div>
  );
}

// Keep unused imports for future filter-detail links.
void ExternalLink;

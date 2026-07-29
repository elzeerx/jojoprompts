import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, RefreshCw, Copy, Info } from "lucide-react";
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
import { useAdminPaymentEvents } from "@/hooks/admin/v2/useAdminCommerce";
import { formatFils, formatDateTime, statusTone, copyToClipboard, bi, BILINGUAL } from "@/lib/v2/admin/format";
import { PaymentEventDetailDialog } from "./PaymentEventDetailDialog";

const EVENT_TYPES = ["created", "authorized", "captured", "failed", "refunded", "chargeback", "reversal"];
const PROVIDERS = ["upayments"]; // extend as gateways come online
const PAGE_SIZE = 25;

export default function PaymentEventsPage() {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();

  const eventType = params.get("type") ?? "";
  const provider = params.get("provider") ?? "";
  const orderId = params.get("order") ?? "";
  const page = Math.max(parseInt(params.get("page") ?? "1", 10), 1);
  const openEventId = params.get("event");
  const [orderInput, setOrderInput] = useState(orderId);

  const query = useAdminPaymentEvents({
    eventType: eventType || null,
    provider: provider || null,
    orderId: orderId || null,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil((query.data?.total_count ?? 0) / PAGE_SIZE));

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key); else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-4 sm:space-y-6" dir="ltr">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payment events / أحداث الدفع</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Info className="h-3.5 w-3.5" /> {BILINGUAL.immutable.en} · {BILINGUAL.immutable.ar}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => query.refetch()}
          aria-label="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            updateParam("order", orderInput.trim() || null);
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Filter payment events by order UUID"
              value={orderInput}
              onChange={(e) => setOrderInput(e.target.value)}
              placeholder="Filter by order UUID"
              className="pl-9 min-h-[44px] font-mono text-xs"
            />
          </div>
          <Button type="submit" className="min-h-[44px]">Apply</Button>
        </form>
        <Select value={eventType || "all"} onValueChange={(v) => updateParam("type", v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={provider || "all"} onValueChange={(v) => updateParam("provider", v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]"><SelectValue placeholder="Provider" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            {PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {query.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {bi("error")}: {(query.error as Error).message}
        </div>
      )}

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : isMobile ? (
        <div className="space-y-2">
          {(query.data?.rows ?? []).map((e) => (
            <Card key={e.id} className="cursor-pointer" onClick={() => updateParam("event", e.id)}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant={statusTone(e.event_type)}>{e.event_type}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(e.received_at)}</span>
                </div>
                <div className="font-mono text-xs">{e.order_number ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {e.provider} · {typeof e.amount_fils === "number" ? formatFils(e.amount_fils) : "—"}
                </div>
              </CardContent>
            </Card>
          ))}
          {(query.data?.rows.length ?? 0) === 0 && (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">{bi("empty")}</div>
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>External event ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data?.rows ?? []).map((e) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => updateParam("event", e.id)}>
                  <TableCell className="text-xs">{formatDateTime(e.received_at)}</TableCell>
                  <TableCell><Badge variant={statusTone(e.event_type)}>{e.event_type}</Badge></TableCell>
                  <TableCell className="text-xs">{e.provider}</TableCell>
                  <TableCell className="font-mono text-xs">{e.order_number ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs truncate max-w-[220px]">{e.external_event_id ?? "—"}</TableCell>
                  <TableCell className="text-xs">{typeof e.amount_fils === "number" ? formatFils(e.amount_fils) : "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-[44px] min-w-[44px]"
                      onClick={async (ev) => {
                        ev.stopPropagation();
                        const ok = await copyToClipboard(e.external_event_id ?? e.id);
                        toast({ description: ok ? "Copied event ID" : "Copy failed" });
                      }}
                      aria-label="Copy event ID"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(query.data?.rows.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">{bi("empty")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>{(query.data?.total_count ?? 0).toLocaleString()} events · Page {page} / {totalPages}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>Prev</Button>
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page >= totalPages} onClick={() => updateParam("page", String(page + 1))}>Next</Button>
        </div>
      </div>

      <PaymentEventDetailDialog
        eventId={openEventId}
        onOpenChange={(open) => !open && updateParam("event", null)}
      />
    </div>
  );
}

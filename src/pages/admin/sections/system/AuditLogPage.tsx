import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, Search, ScrollText, ExternalLink } from "lucide-react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateTime } from "@/lib/v2/admin/format";
import { shortId } from "@/lib/v2/admin/auditDeepLinks";
import {
  useAdminAuditLog,
  AUDIT_ACTION_ALLOWLIST,
  AUDIT_ACTOR_TYPES,
  AUDIT_ENTITY_TYPES,
} from "@/hooks/admin/v2/useAdminAuditLog";
import AuditEventDetailSheet from "./AuditEventDetailSheet";

const PAGE_SIZE = 50;

function actorTone(t: string): "default" | "secondary" | "destructive" | "outline" {
  if (t === "admin") return "default";
  if (t === "system") return "secondary";
  return "outline";
}

export default function AuditLogPage() {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [openId, setOpenId] = useState<string | null>(null);

  const actorType = params.get("actor_type") ?? "";
  const entityType = params.get("entity_type") ?? "";
  const action = params.get("action") ?? "";
  const search = params.get("q") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const page = Math.max(parseInt(params.get("page") ?? "1", 10), 1);

  const [searchInput, setSearchInput] = useState(search);

  const query = useAdminAuditLog({
    actorTypes: actorType ? [actorType] : null,
    entityTypes: entityType ? [entityType] : null,
    actions: action ? [action] : null,
    search: search || null,
    from: from || null,
    to: to || null,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const total = query.data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key); else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    setParams(next, { replace: true });
    setSearchInput("");
  };

  const hasFilters = useMemo(
    () => !!(actorType || entityType || action || search || from || to),
    [actorType, entityType, action, search, from, to]
  );

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0" dir="ltr">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-warm-gold" />
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight break-words">
              Audit Log
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Consolidated timeline of admin and system actions across V2 —
            reports, orders, refunds, discounts, downloads, scans, and versions.
          </p>
        </div>
        <div className="flex gap-2">
          {hasFilters && (
            <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={clearFilters}>
              Clear
            </Button>
          )}
          <Button
            variant="outline" size="icon"
            className="min-h-[44px] min-w-[44px]"
            aria-label="Refresh"
            onClick={() => query.refetch()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <form
          className="sm:col-span-2 lg:col-span-2 flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); updateParam("q", searchInput.trim() || null); }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search action or entity type"
              className="pl-9 min-h-[44px]"
              aria-label="Search audit"
            />
          </div>
          <Button type="submit" className="min-h-[44px]">Search</Button>
        </form>

        <Select value={actorType || "all"} onValueChange={(v) => updateParam("actor_type", v === "all" ? null : v)}>
          <SelectTrigger className="min-h-[44px]" aria-label="Actor type">
            <SelectValue placeholder="Actor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any actor</SelectItem>
            {AUDIT_ACTOR_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={entityType || "all"} onValueChange={(v) => updateParam("entity_type", v === "all" ? null : v)}>
          <SelectTrigger className="min-h-[44px]" aria-label="Entity type">
            <SelectValue placeholder="Entity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any entity</SelectItem>
            {AUDIT_ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={action || "all"} onValueChange={(v) => updateParam("action", v === "all" ? null : v)}>
          <SelectTrigger className="min-h-[44px]" aria-label="Action">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">Any action</SelectItem>
            {AUDIT_ACTION_ALLOWLIST.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-6">
          <label className="text-xs text-muted-foreground shrink-0">From</label>
          <Input
            type="datetime-local"
            value={from}
            onChange={(e) => updateParam("from", e.target.value || null)}
            className="min-h-[44px]"
            aria-label="From"
          />
          <label className="text-xs text-muted-foreground shrink-0">To</label>
          <Input
            type="datetime-local"
            value={to}
            onChange={(e) => updateParam("to", e.target.value || null)}
            className="min-h-[44px]"
            aria-label="To"
          />
        </div>
      </div>

      {query.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive break-words">
          Error: {(query.error as Error).message}
        </div>
      )}

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : isMobile ? (
        <div className="space-y-2">
          {(query.data?.rows ?? []).map((r) => (
            <Card key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
              <CardContent className="p-3 space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={actorTone(r.actor_type)}>{r.actor_type}</Badge>
                  <Badge className="break-all">{r.action}</Badge>
                </div>
                <div className="text-xs text-muted-foreground break-words">
                  {r.entity_type} · {shortId(r.entity_id)}
                </div>
                <div className="text-xs text-muted-foreground break-words">
                  {r.actor_email_masked ?? r.actor_username ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</div>
              </CardContent>
            </Card>
          ))}
          {(query.data?.rows.length ?? 0) === 0 && (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              No events
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Id</TableHead>
                <TableHead>IP</TableHead>
                <TableHead className="w-[60px]">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data?.rows ?? []).map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(r.created_at)}</TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col">
                      <Badge variant={actorTone(r.actor_type)} className="w-fit">{r.actor_type}</Badge>
                      <span className="mt-1 text-[11px] text-muted-foreground truncate max-w-[180px]">
                        {r.actor_email_masked ?? r.actor_username ?? "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs break-all">{r.action}</TableCell>
                  <TableCell className="text-xs">{r.entity_type}</TableCell>
                  <TableCell className="text-xs font-mono">{shortId(r.entity_id)}</TableCell>
                  <TableCell className="text-xs font-mono">{r.ip_address ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost" size="icon"
                      className="min-h-[44px] min-w-[44px]"
                      onClick={(e) => { e.stopPropagation(); setOpenId(r.id); }}
                      aria-label="Open event"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(query.data?.rows.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                    No events
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>{total.toLocaleString()} events · Page {page} / {totalPages}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>Prev</Button>
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page >= totalPages} onClick={() => updateParam("page", String(page + 1))}>Next</Button>
        </div>
      </div>

      <AuditEventDetailSheet
        eventId={openId}
        onOpenChange={(open) => { if (!open) setOpenId(null); }}
      />
    </div>
  );
}

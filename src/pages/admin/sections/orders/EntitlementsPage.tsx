import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, RefreshCw, Copy } from "lucide-react";
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
import { useAdminEntitlements } from "@/hooks/admin/v2/useAdminCommerce";
import { formatDateTime, copyToClipboard, bi } from "@/lib/v2/admin/format";

const SCOPES = ["resource", "library"];
const STATES = ["active", "revoked", "expired"];
const REASONS = ["purchase", "free_acquisition", "lifetime_purchase", "lifetime_threshold", "legacy_migration", "admin_grant"];
const PAGE_SIZE = 25;

function stateTone(state: string) {
  if (state === "active") return "default";
  if (state === "revoked") return "destructive";
  return "outline";
}

export default function EntitlementsPage() {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();

  const scope = params.get("scope") ?? "";
  const state = params.get("state") ?? "";
  const reason = params.get("reason") ?? "";
  const search = params.get("q") ?? "";
  const page = Math.max(parseInt(params.get("page") ?? "1", 10), 1);
  const [searchInput, setSearchInput] = useState(search);

  const query = useAdminEntitlements({
    scope: scope || null,
    state: state || null,
    reason: reason || null,
    search: search || null,
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
          <h1 className="text-2xl font-semibold tracking-tight">Entitlements / حقوق الوصول</h1>
          <p className="text-sm text-muted-foreground">
            Grants ledger. Read-only in this phase — no direct table edits.
          </p>
        </div>
        <Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px]" onClick={() => query.refetch()} aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="flex flex-1 items-center gap-2" onSubmit={(e) => { e.preventDefault(); updateParam("q", searchInput.trim() || null); }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search email or resource title" className="pl-9 min-h-[44px]" />
          </div>
          <Button type="submit" className="min-h-[44px]">{bi("search")}</Button>
        </form>
        <Select value={state || "all"} onValueChange={(v) => updateParam("state", v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-[160px] min-h-[44px]"><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any state</SelectItem>
            {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={scope || "all"} onValueChange={(v) => updateParam("scope", v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-[160px] min-h-[44px]"><SelectValue placeholder="Scope" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any scope</SelectItem>
            {SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={reason || "all"} onValueChange={(v) => updateParam("reason", v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]"><SelectValue placeholder="Reason" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any reason</SelectItem>
            {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {query.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {bi("error")}: {(query.error as Error).message}
        </div>
      )}

      {query.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : isMobile ? (
        <div className="space-y-2">
          {(query.data?.rows ?? []).map((e) => (
            <Card key={e.id}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant={stateTone(e.state) as never}>{e.state}</Badge>
                  <Badge variant="secondary">{e.grant_reason}</Badge>
                </div>
                <div className="text-sm">{e.resource_title ?? (e.scope === "library" ? "Full library" : "—")}</div>
                <div className="text-xs text-muted-foreground">{e.user_email_masked ?? "—"} · {e.scope}</div>
                <div className="text-xs text-muted-foreground">granted {formatDateTime(e.granted_at)}</div>
                {e.revoked_at && <div className="text-xs text-destructive">revoked {formatDateTime(e.revoked_at)} — {e.revoke_reason ?? ""}</div>}
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
                <TableHead>Customer</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Granted</TableHead>
                <TableHead>Revoked</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data?.rows ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs">{e.user_email_masked ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{e.scope}</Badge></TableCell>
                  <TableCell className="text-xs">{e.resource_title ?? (e.scope === "library" ? "Full library" : "—")}</TableCell>
                  <TableCell><Badge variant="secondary">{e.grant_reason}</Badge></TableCell>
                  <TableCell><Badge variant={stateTone(e.state) as never}>{e.state}</Badge></TableCell>
                  <TableCell className="text-xs">{formatDateTime(e.granted_at)}</TableCell>
                  <TableCell className="text-xs">{e.revoked_at ? formatDateTime(e.revoked_at) : "—"}</TableCell>
                  <TableCell className="text-xs">{e.expires_at ? formatDateTime(e.expires_at) : "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-[44px] min-w-[44px]"
                      onClick={async () => {
                        const target = e.order_id ?? e.id;
                        const ok = await copyToClipboard(target);
                        toast({ description: ok ? "Copied ID" : "Copy failed" });
                      }}
                      aria-label="Copy ID"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(query.data?.rows.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">{bi("empty")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>{(query.data?.total_count ?? 0).toLocaleString()} entitlements · Page {page} / {totalPages}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>Prev</Button>
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page >= totalPages} onClick={() => updateParam("page", String(page + 1))}>Next</Button>
        </div>
      </div>
    </div>
  );
}

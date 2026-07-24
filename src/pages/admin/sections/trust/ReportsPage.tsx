import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, Search, ExternalLink } from "lucide-react";
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
import { useAdminReports, type ReportStatus } from "@/hooks/admin/v2/useAdminReports";
import ReportDetailSheet from "./ReportDetailSheet";

const STATUSES: ReportStatus[] = ["open", "reviewing", "resolved", "dismissed"];
const PAGE_SIZE = 25;

function statusTone(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "open") return "destructive";
  if (s === "reviewing") return "default";
  if (s === "resolved") return "secondary";
  return "outline";
}

export default function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [openId, setOpenId] = useState<string | null>(null);

  const status = params.get("status") ?? "";
  const search = params.get("q") ?? "";
  const page = Math.max(parseInt(params.get("page") ?? "1", 10), 1);
  const [searchInput, setSearchInput] = useState(search);

  const query = useAdminReports({
    status: status ? ([status as ReportStatus]) : null,
    search: search || null,
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

  return (
    <div className="space-y-4 sm:space-y-6" dir="ltr">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports / البلاغات</h1>
          <p className="text-sm text-muted-foreground">
            User-submitted reports on resources. Triage: open → reviewing → resolved / dismissed.
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
          onSubmit={(e) => { e.preventDefault(); updateParam("q", searchInput.trim() || null); }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search resource slug or title"
              className="pl-9 min-h-[44px]"
              aria-label="Search reports"
            />
          </div>
          <Button type="submit" className="min-h-[44px]">Search</Button>
        </form>
        <Select value={status || "all"} onValueChange={(v) => updateParam("status", v === "all" ? null : v)}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]" aria-label="Status filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {query.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Error: {(query.error as Error).message}
        </div>
      )}

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : isMobile ? (
        <div className="space-y-2">
          {(query.data?.rows ?? []).map((r) => (
            <Card key={r.id} className="cursor-pointer" onClick={() => setOpenId(r.id)}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant={statusTone(r.status)}>{r.status}</Badge>
                  <Badge variant="outline" className="capitalize">{r.category}</Badge>
                </div>
                <div className="text-sm font-medium truncate">{r.resource_title ?? r.resource_slug ?? "—"}</div>
                <div className="text-xs text-muted-foreground truncate">{r.reporter_email_masked ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</div>
              </CardContent>
            </Card>
          ))}
          {(query.data?.rows.length ?? 0) === 0 && (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">No reports</div>
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[80px]">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data?.rows ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Badge variant={statusTone(r.status)}>{r.status}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{r.category}</Badge></TableCell>
                  <TableCell className="text-xs max-w-[300px] truncate">{r.resource_title ?? r.resource_slug ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.reporter_email_masked ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(r.created_at)}</TableCell>
                  <TableCell className="text-xs">{formatDateTime(r.updated_at)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-[44px] min-w-[44px]"
                      onClick={() => setOpenId(r.id)}
                      aria-label="Open report"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(query.data?.rows.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">No reports</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>{total.toLocaleString()} reports · Page {page} / {totalPages}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page <= 1} onClick={() => updateParam("page", String(page - 1))}>Prev</Button>
          <Button variant="outline" size="sm" className="min-h-[44px]" disabled={page >= totalPages} onClick={() => updateParam("page", String(page + 1))}>Next</Button>
        </div>
      </div>

      <ReportDetailSheet
        reportId={openId}
        rows={query.data?.rows ?? []}
        onOpenChange={(open) => { if (!open) setOpenId(null); }}
      />
    </div>
  );
}

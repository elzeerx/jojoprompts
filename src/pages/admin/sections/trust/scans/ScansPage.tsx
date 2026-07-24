import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, Search, X } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateTime } from "@/lib/v2/admin/format";
import {
  useAdminPackageScans,
  PACKAGE_SCAN_STATES,
  type PackageScanState,
} from "@/hooks/admin/v2/useAdminPackageScans";
import {
  attentionCount,
  clampPage,
  formatBytes,
  statusLabel,
  statusTone,
  totalPagesFor,
} from "./scanHelpers";
import ScanDetailSheet from "./ScanDetailSheet";
import CloudmersiveStatusCard from "./CloudmersiveStatusCard";

const PAGE_SIZE = 50;

function parseCsv<T extends string>(v: string | null, valid: T[]): T[] {
  if (!v) return [];
  return v.split(",").filter((x): x is T => (valid as string[]).includes(x));
}

export default function ScansPage() {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [openId, setOpenId] = useState<string | null>(null);

  const states = useMemo(
    () => parseCsv<PackageScanState>(params.get("states"), PACKAGE_SCAN_STATES),
    [params],
  );
  const search = params.get("q") ?? "";
  const rawPage = Math.max(parseInt(params.get("page") ?? "1", 10) || 1, 1);
  const [searchInput, setSearchInput] = useState(search);

  const query = useAdminPackageScans({
    states: states.length ? states : null,
    search: search || null,
    limit: PAGE_SIZE,
    offset: (rawPage - 1) * PAGE_SIZE,
  });

  const summary = query.data?.summary ?? null;
  const total = query.data?.total_count ?? 0;
  const totalPages = totalPagesFor(total, PAGE_SIZE);
  const page = clampPage(rawPage, totalPages);
  const totalWithFiles = summary?.total_with_files ?? 0;
  const hasFilters = states.length > 0 || !!search;

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  const toggleState = (s: PackageScanState) => {
    const nextSet = new Set(states);
    if (nextSet.has(s)) nextSet.delete(s);
    else nextSet.add(s);
    updateParam(
      "states",
      nextSet.size ? Array.from(nextSet).join(",") : null,
    );
  };

  const clearFilters = () => {
    const next = new URLSearchParams(params);
    ["states", "q", "page"].forEach((k) => next.delete(k));
    setParams(next, { replace: true });
    setSearchInput("");
  };

  const goto = (p: number) => {
    const clamped = clampPage(p, totalPages);
    const next = new URLSearchParams(params);
    if (clamped <= 1) next.delete("page");
    else next.set("page", String(clamped));
    setParams(next, { replace: true });
  };

  const cards = [
    { label: "Needs attention", value: attentionCount(summary) },
    { label: "Unscanned", value: summary?.unscanned ?? 0 },
    { label: "Pending", value: summary?.pending ?? 0 },
    { label: "Clean", value: summary?.clean ?? 0 },
    { label: "Total packages", value: totalWithFiles },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0" dir="ltr">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight break-words">
            Package Scans
          </h1>
          <p className="text-sm text-muted-foreground break-words">
            Read-only queue and history of package files awaiting a clean scan
            result. Uploads for a version remain unavailable until its latest
            scan is clean.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="min-h-[44px] min-w-[44px] shrink-0 self-start sm:self-auto"
          onClick={() => query.refetch()}
          aria-label="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>


      <CloudmersiveStatusCard />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {cards.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs text-muted-foreground">{m.label}</div>
              <div className="text-2xl font-semibold tabular-nums">
                {m.value.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <form
          className="flex flex-1 min-w-[220px] items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            updateParam("q", searchInput.trim() || null);
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search slug, title, version, scanner"
              className="pl-9 min-h-[44px]"
              aria-label="Search package scans"
            />
          </div>
          <Button type="submit" className="min-h-[44px]">
            Search
          </Button>
        </form>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-auto min-h-[44px]"
            >
              State {states.length ? `(${states.length})` : ""}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Latest scan state</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PACKAGE_SCAN_STATES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={states.includes(s)}
                onCheckedChange={() => toggleState(s)}
                onSelect={(e) => e.preventDefault()}
              >
                {statusLabel(s)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasFilters ? (
          <Button
            variant="ghost"
            className="min-h-[44px]"
            onClick={clearFilters}
          >
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        ) : null}
      </div>

      {query.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Error: {(query.error as Error).message}
        </div>
      )}

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (query.data?.rows ?? []).length === 0 ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          {totalWithFiles === 0 ? (
            <>
              <div className="font-medium text-foreground">
                No package files yet
              </div>
              <div className="mt-1">
                Admins upload package files from Publishing → Versions. Once a
                file exists, its version appears here for scan tracking.
              </div>
            </>
          ) : (
            <>
              <div className="font-medium text-foreground">
                No packages match these filters
              </div>
              <div className="mt-1">
                Adjust or clear the filters to see more packages.
              </div>
            </>
          )}
        </div>
      ) : isMobile ? (
        <div className="space-y-2">
          {(query.data?.rows ?? []).map((r) => {
            const label = `Open ${r.title_en || r.slug} v${r.version}`;
            return (
              <button
                key={r.version_id}
                type="button"
                onClick={() => setOpenId(r.version_id)}
                aria-label={label}
                className="w-full min-h-[44px] rounded-md border bg-card p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {r.title_en || r.slug}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.slug} · v{r.version}
                    </div>
                  </div>
                  <Badge variant={statusTone(r.latest_scan_status)}>
                    {statusLabel(r.latest_scan_status)}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="capitalize">
                    {r.resource_type.replace("_", " ")}
                  </span>
                  <span>
                    {r.file_count} file{r.file_count === 1 ? "" : "s"}
                  </span>
                  <span>{formatBytes(r.package_size_bytes)}</span>
                  <span>{r.is_current ? "current" : "historical"}</span>
                  <span>{r.latest_scanner || "—"}</span>
                  <span>
                    {formatDateTime(
                      r.latest_scanned_at ?? r.latest_scan_created_at,
                    )}
                  </span>
                  {r.findings_count > 0 && (
                    <span>
                      {r.findings_count} finding
                      {r.findings_count === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Files</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scanner</TableHead>
                <TableHead>Last result</TableHead>
                <TableHead className="text-right">Findings</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data?.rows ?? []).map((r) => (
                <TableRow key={r.version_id}>
                  <TableCell className="max-w-[280px]">
                    <div className="font-medium truncate">
                      {r.title_en || r.slug}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.slug}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">
                    {r.resource_type.replace("_", " ")}
                  </TableCell>
                  <TableCell>
                    <div>v{r.version}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.is_current ? "current" : "historical"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.file_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBytes(r.package_size_bytes)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusTone(r.latest_scan_status)}>
                      {statusLabel(r.latest_scan_status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.latest_scanner || "—"}</TableCell>
                  <TableCell>
                    {formatDateTime(
                      r.latest_scanned_at ?? r.latest_scan_created_at,
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.findings_count}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={() => setOpenId(r.version_id)}
                      aria-label={`View details for ${r.title_en || r.slug} v${r.version}`}
                    >
                      View details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            Page {page} of {totalPages} · {total.toLocaleString()} packages
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="min-h-[44px]"
              disabled={page <= 1}
              onClick={() => goto(page - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px]"
              disabled={page >= totalPages}
              onClick={() => goto(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ScanDetailSheet
        versionId={openId}
        onOpenChange={(open) => !open && setOpenId(null)}
      />
    </div>
  );
}

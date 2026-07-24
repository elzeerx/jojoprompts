import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, Search, ExternalLink, X } from "lucide-react";
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
  useAdminResourceVersions,
  type ResourceType,
  type ScanState,
  type CurrentFilter,
} from "@/hooks/admin/v2/useAdminResourceVersions";
import VersionDetailSheet from "./VersionDetailSheet";

const PAGE_SIZE = 50;
const TYPES: ResourceType[] = [
  "skill",
  "automation",
  "prompt",
  "prompt_pack",
  "image_style",
  "bundle",
];
const SCAN_STATES: ScanState[] = [
  "unscanned",
  "pending",
  "clean",
  "suspicious",
  "malicious",
  "failed",
];

function scanTone(
  s: ScanState | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (s === "clean") return "secondary";
  if (s === "pending") return "default";
  if (s === "suspicious" || s === "malicious" || s === "failed")
    return "destructive";
  return "outline";
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function parseCsv<T extends string>(v: string | null, valid: T[]): T[] {
  if (!v) return [];
  return v.split(",").filter((x): x is T => (valid as string[]).includes(x));
}

export default function VersionsRegistryPage() {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [openId, setOpenId] = useState<string | null>(null);

  const types = useMemo(
    () => parseCsv<ResourceType>(params.get("types"), TYPES),
    [params],
  );
  const scans = useMemo(
    () => parseCsv<ScanState>(params.get("scans"), SCAN_STATES),
    [params],
  );
  const currentRaw = (params.get("current") ?? "all") as CurrentFilter;
  const current: CurrentFilter = (
    ["all", "current", "historical"] as const
  ).includes(currentRaw)
    ? currentRaw
    : "all";
  const search = params.get("q") ?? "";
  const page = Math.max(parseInt(params.get("page") ?? "1", 10), 1);
  const [searchInput, setSearchInput] = useState(search);

  const query = useAdminResourceVersions({
    types: types.length ? types : null,
    scanStates: scans.length ? scans : null,
    current,
    search: search || null,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const summary = query.data?.summary;
  const total = query.data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };

  const toggleType = (t: ResourceType) => {
    const nextSet = new Set(types);
    if (nextSet.has(t)) nextSet.delete(t);
    else nextSet.add(t);
    updateParam("types", nextSet.size ? Array.from(nextSet).join(",") : null);
  };
  const toggleScan = (s: ScanState) => {
    const nextSet = new Set(scans);
    if (nextSet.has(s)) nextSet.delete(s);
    else nextSet.add(s);
    updateParam("scans", nextSet.size ? Array.from(nextSet).join(",") : null);
  };

  const clearFilters = () => {
    const next = new URLSearchParams(params);
    ["types", "scans", "current", "q", "page"].forEach((k) => next.delete(k));
    setParams(next, { replace: true });
    setSearchInput("");
  };

  return (
    <div className="space-y-4 sm:space-y-6" dir="ltr">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Versions</h1>
          <p className="text-sm text-muted-foreground">
            Read-only registry of resource_versions. Package files and scans are
            surfaced when present; uploads and re-scans land in a later slice.
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Total versions", value: summary?.total_versions ?? 0 },
          { label: "Current", value: summary?.current_versions ?? 0 },
          { label: "With files", value: summary?.versions_with_files ?? 0 },
          { label: "Scan attention", value: summary?.scan_attention ?? 0 },
        ].map((m) => (
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
              placeholder="Search slug, title or version"
              className="pl-9 min-h-[44px]"
              aria-label="Search versions"
            />
          </div>
          <Button type="submit" className="min-h-[44px]">
            Search
          </Button>
        </form>

        <Select
          value={current}
          onValueChange={(v) => updateParam("current", v === "all" ? null : v)}
        >
          <SelectTrigger
            className="w-full sm:w-[160px] min-h-[44px]"
            aria-label="Current filter"
          >
            <SelectValue placeholder="All versions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="current">Current only</SelectItem>
            <SelectItem value="historical">Historical only</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-auto min-h-[44px]"
            >
              Type {types.length ? `(${types.length})` : ""}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Resource type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TYPES.map((t) => (
              <DropdownMenuCheckboxItem
                key={t}
                checked={types.includes(t)}
                onCheckedChange={() => toggleType(t)}
                onSelect={(e) => e.preventDefault()}
              >
                {t}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-auto min-h-[44px]"
            >
              Scan {scans.length ? `(${scans.length})` : ""}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Scan state</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {SCAN_STATES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={scans.includes(s)}
                onCheckedChange={() => toggleScan(s)}
                onSelect={(e) => e.preventDefault()}
              >
                {s}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {(types.length || scans.length || current !== "all" || search) ? (
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
      ) : isMobile ? (
        <div className="space-y-2">
          {(query.data?.rows ?? []).map((r) => (
            <Card
              key={r.version_id}
              className="cursor-pointer"
              onClick={() => setOpenId(r.version_id)}
            >
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="capitalize">
                    {r.resource_type.replace("_", " ")}
                  </Badge>
                  <div className="flex items-center gap-1">
                    {r.is_current && (
                      <Badge variant="default">current</Badge>
                    )}
                    <Badge variant={scanTone(r.latest_scan_status)}>
                      {r.latest_scan_status ?? "unscanned"}
                    </Badge>
                  </div>
                </div>
                <div className="text-sm font-medium truncate">
                  {r.title_en || r.slug}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.slug} · v{r.version}
                </div>
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>Files: {r.file_count}</span>
                  <span>{formatDateTime(r.updated_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {(query.data?.rows.length ?? 0) === 0 && (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              No versions match these filters
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resource</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Scan</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[80px]">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data?.rows ?? []).map((r) => (
                <TableRow key={r.version_id}>
                  <TableCell className="max-w-[280px]">
                    <div className="truncate text-sm font-medium">
                      {r.title_en || r.slug}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.slug}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {r.resource_type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    v{r.version}
                  </TableCell>
                  <TableCell>
                    {r.is_current ? (
                      <Badge variant="default">current</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDateTime(r.published_at)}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {r.file_count}
                  </TableCell>
                  <TableCell>
                    <Badge variant={scanTone(r.latest_scan_status)}>
                      {r.latest_scan_status ?? "unscanned"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDateTime(r.updated_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-[44px] min-w-[44px]"
                      onClick={() => setOpenId(r.version_id)}
                      aria-label="Open version detail"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(query.data?.rows.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    No versions match these filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground gap-2 flex-wrap">
        <div>
          {total.toLocaleString()} versions · Page {page} / {totalPages}
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

      <VersionDetailSheet
        versionId={openId}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
      />

      <p className="text-[11px] text-muted-foreground">
        Package size shown when set; {formatBytes(null)} indicates missing
        metadata.
      </p>
    </div>
  );
}

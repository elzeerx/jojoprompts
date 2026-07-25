import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  ArrowLeftCircle,
  CheckCircle2,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Send,
} from "lucide-react";
import { PublishingQueueDetailSheet } from "./PublishingQueueDetailSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "@/hooks/use-toast";
import { formatDateTime, formatFils } from "@/lib/v2/admin/format";
import {
  deriveReadiness,
  describeReadiness,
  type Lifecycle,
  type QueueRowInput,
  type ResourceType,
  type ScanState,
} from "@/lib/v2/admin/publishingReadiness";

const RESOURCE_TYPES: { value: ResourceType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "skill", label: "Skill" },
  { value: "automation", label: "Automation" },
  { value: "prompt", label: "Prompt" },
  { value: "prompt_pack", label: "Prompt pack" },
  { value: "image_style", label: "Image style" },
  { value: "bundle", label: "Bundle" },
];

const PAGE_SIZE = 25;

type Mode = "draft" | "review";

interface Fetched extends QueueRowInput {
  slug: string;
  title_ar: string | null;
  updated_at: string;
  submitted_at: string | null;
  current_version_label: string | null;
  price_fils: number | null;
}

interface QueryArgs {
  mode: Mode;
  page: number;
  search: string;
  type: ResourceType | "all";
}

async function fetchQueue(args: QueryArgs): Promise<{ rows: Fetched[]; total: number }> {
  const lifecycle: Lifecycle = args.mode;
  const from = (args.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = (supabase as any)
    .from("resources")
    .select(
      "id, slug, type, lifecycle, title_en, title_ar, summary_en, description_en, current_version_id, updated_at, current_version:current_version_id ( id, version, major_version ), platform_compatibility ( platform_slug ), installation_guides ( id )",
      { count: "exact" },
    )
    .eq("lifecycle", lifecycle)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (args.type !== "all") q = q.eq("type", args.type);
  if (args.search.trim()) {
    const s = args.search.trim().replace(/[,()]/g, "");
    q = q.or(`title_en.ilike.%${s}%,title_ar.ilike.%${s}%,slug.ilike.%${s}%`);
  }

  const { data, count, error } = await q;
  if (error) throw error;
  const base = (data ?? []) as any[];

  const versionIds = base.map((r) => r.current_version_id).filter(Boolean) as string[];
  const resourceIds = base.map((r) => r.id);

  const [filesRes, scansRes, productsRes] = await Promise.all([
    versionIds.length
      ? (supabase as any)
          .from("resource_files")
          .select("resource_version_id")
          .in("resource_version_id", versionIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    versionIds.length
      ? (supabase as any)
          .from("package_scans")
          .select("resource_version_id, status, created_at, scanned_at")
          .in("resource_version_id", versionIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[], error: null }),
    resourceIds.length
      ? (supabase as any)
          .from("products")
          .select("resource_id, price_fils, is_active")
          .in("resource_id", resourceIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const files = new Map<string, number>();
  ((filesRes as any).data ?? []).forEach((f: any) => {
    files.set(f.resource_version_id, (files.get(f.resource_version_id) ?? 0) + 1);
  });
  const scans = new Map<string, ScanState>();
  ((scansRes as any).data ?? []).forEach((s: any) => {
    if (!scans.has(s.resource_version_id)) scans.set(s.resource_version_id, s.status as ScanState);
  });
  const priceByResource = new Map<string, number | null>();
  const activeByResource = new Map<string, boolean>();
  ((productsRes as any).data ?? []).forEach((p: any) => {
    if (p.is_active) {
      activeByResource.set(p.resource_id, true);
      const cur = priceByResource.get(p.resource_id);
      if (cur == null || (p.price_fils ?? 0) < cur) {
        priceByResource.set(p.resource_id, p.price_fils ?? 0);
      }
    }
  });

  const rows: Fetched[] = base.map((r) => {
    const vid = r.current_version_id as string | null;
    const scan_status = (vid ? scans.get(vid) : "none") ?? "none";
    return {
      id: r.id,
      slug: r.slug,
      type: r.type,
      lifecycle: r.lifecycle,
      title_en: r.title_en,
      title_ar: r.title_ar,
      summary_en: r.summary_en,
      description_en: r.description_en,
      current_version_id: vid,
      updated_at: r.updated_at,
      submitted_at: null,
      current_version_label: r.current_version
        ? `v${r.current_version.major_version}.${r.current_version.version}`
        : null,
      file_count: vid ? files.get(vid) ?? 0 : 0,
      scan_status,
      has_platform_compatibility: (r.platform_compatibility ?? []).length > 0,
      has_installation_guide: (r.installation_guides ?? []).length > 0,
      has_active_product: activeByResource.get(r.id) === true,
      price_fils: priceByResource.get(r.id) ?? null,
    };
  });

  return { rows, total: count ?? 0 };
}

function scanBadge(v: ScanState) {
  const tone: Record<ScanState, string> = {
    clean: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    suspicious: "bg-orange-50 text-orange-700 border-orange-200",
    malicious: "bg-red-50 text-red-700 border-red-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    none: "",
  };
  const label = v === "none" ? "Unscanned" : v;
  return (
    <Badge variant="outline" className={`text-[10px] capitalize ${tone[v]}`}>{label}</Badge>
  );
}

interface Props {
  mode: Mode;
  title: string;
  subtitle: string;
}

export function PublishingQueue({ mode, title, subtitle }: Props) {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const page = Math.max(parseInt(params.get("page") ?? "1", 10), 1);
  const search = params.get("q") ?? "";
  const type = (params.get("type") as ResourceType | "all") ?? "all";
  const [searchInput, setSearchInput] = useState(search);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<Fetched | null>(null);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params);
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
      if (key !== "page") next.delete("page");
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const queryKey = useMemo(
    () => ["admin", "v2", "publishing-queue", { mode, page, search, type }] as const,
    [mode, page, search, type],
  );
  const q = useQuery({
    queryKey,
    queryFn: () => fetchQueue({ mode, page, search, type }),
    staleTime: 15_000,
  });

  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = q.data?.rows ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "v2", "publishing-queue"] });
    qc.invalidateQueries({ queryKey: ["admin", "v2", "catalog"] });
    qc.invalidateQueries({ queryKey: ["admin", "v2", "overview"] });
  };

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("admin_publish_resource", {
        p_resource_id: id,
      });
      if (error) throw new Error(error.message);
      const payload = data as { ok?: boolean; errors?: string[] } | null;
      if (!payload?.ok) {
        const errs = payload?.errors ?? ["unknown"];
        throw new Error(errs.join(", "));
      }
    },
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: () => {
      toast({ title: "Published", description: "Resource is now live in the catalog." });
      invalidate();
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Publish blocked", description: e?.message ?? "unknown" });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async (args: { id: string; action: "review" | "archive" | "restore" }) => {
      const { data, error } = await supabase.rpc("admin_transition_resource_lifecycle", {
        p_resource_id: args.id,
        p_action: args.action,
      });
      if (error) throw new Error(error.message);
      const payload = data as { ok?: boolean; error?: string; errors?: string[] } | null;
      if (!payload?.ok) {
        const errs = payload?.errors;
        if (Array.isArray(errs) && errs.length > 0) throw new Error(errs.join(", "));
        throw new Error(payload?.error ?? "failed");
      }
      return args.action;
    },
    onMutate: (v) => setBusyId(v.id),
    onSettled: () => setBusyId(null),
    onSuccess: (action) => {
      const label =
        action === "review" ? "Submitted for review" :
        action === "archive" ? "Archived" : "Returned to draft";
      toast({ title: label });
      invalidate();
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Action failed", description: e?.message ?? "unknown" });
    },
  });

  const renderReadiness = (r: Fetched) => {
    const rd = deriveReadiness(r);
    if (rd.blockers.length === 0) {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
          <CheckCircle2 className="mr-1 h-3 w-3" /> Ready
        </Badge>
      );
    }
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] cursor-help">
              <AlertTriangle className="mr-1 h-3 w-3" /> {rd.blockers.length} to resolve
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <ul className="list-disc space-y-1 pl-4 text-xs">
              {rd.blockers.map((b) => (
                <li key={b}>{describeReadiness(b)}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const actionsFor = (r: Fetched) => {
    const rd = deriveReadiness(r);
    const busy = busyId === r.id;
    const viewBtn = (
      <Button
        size="sm"
        variant="outline"
        className="min-h-[44px]"
        onClick={() => setDetailRow(r)}
      >
        <Eye className="mr-1 h-4 w-4" /> View details
      </Button>
    );
    if (mode === "draft") {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {viewBtn}
          <Button asChild size="sm" variant="outline" className="min-h-[44px]">
            <Link to={`/admin/publishing/resources/${r.id}/edit`}>
              <Pencil className="mr-1 h-4 w-4" /> Continue editing
            </Link>
          </Button>
          <Button
            size="sm"
            className="min-h-[44px] bg-warm-gold text-dark-base hover:bg-warm-gold/90"
            disabled={!rd.isSubmittable || busy}
            onClick={() => transitionMutation.mutate({ id: r.id, action: "review" })}
          >
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
            Submit for review
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="min-h-[44px] text-red-600 hover:text-red-700"
            disabled={busy}
            onClick={() => transitionMutation.mutate({ id: r.id, action: "archive" })}
          >
            <Archive className="mr-1 h-4 w-4" /> Archive
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        {viewBtn}
        <Button
          size="sm"
          className="min-h-[44px] bg-warm-gold text-dark-base hover:bg-warm-gold/90"
          disabled={!rd.isPublishable || busy}
          onClick={() => publishMutation.mutate(r.id)}
        >
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
          Approve & publish
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-h-[44px]"
          disabled={busy}
          onClick={() => transitionMutation.mutate({ id: r.id, action: "restore" })}
        >
          <ArrowLeftCircle className="mr-1 h-4 w-4" /> Return to draft
        </Button>
        <Button asChild size="sm" variant="ghost" className="min-h-[44px]">
          <Link to={`/admin/publishing/resources/${r.id}/edit`}>
            <Pencil className="mr-1 h-4 w-4" /> Review edits
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="min-h-[44px] text-red-600 hover:text-red-700"
          disabled={busy}
          onClick={() => transitionMutation.mutate({ id: r.id, action: "archive" })}
        >
          <Archive className="mr-1 h-4 w-4" /> Archive
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6" dir="ltr">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-dark-base">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="min-h-[44px] min-w-[44px]"
          onClick={() => q.refetch()}
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form
          className="flex flex-1 min-w-0 items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); updateParam("q", searchInput.trim() || null); }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title or slug"
              className="ps-9 min-h-[44px] w-full"
              aria-label="Search queue"
            />
          </div>
          <Button type="submit" variant="outline" className="min-h-[44px]">Apply</Button>
        </form>
        <Select value={type} onValueChange={(v) => updateParam("type", v)}>
          <SelectTrigger className="min-h-[44px] w-full sm:w-[180px]" aria-label="Filter by type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESOURCE_TYPES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : q.isError ? (
        <Card className="p-6 text-sm text-red-600">
          Failed to load queue: {(q.error as any)?.message ?? "unknown"}
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {mode === "draft"
            ? "No drafts right now. New drafts land here when you create a resource."
            : "Nothing awaiting review. Drafts submitted for review will appear here."}
        </Card>
      ) : isMobile ? (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-4 space-y-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-dark-base break-words">
                  {r.title_en || r.slug}
                </div>
                {r.title_ar ? (
                  <div className="text-xs text-muted-foreground break-words" dir="rtl">{r.title_ar}</div>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="outline" className="capitalize">{r.type.replace("_", " ")}</Badge>
                  {r.current_version_label ? <span>{r.current_version_label}</span> : <span>no version</span>}
                  <span>·</span>
                  <span>Updated {formatDateTime(r.updated_at)}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {renderReadiness(r)}
                {scanBadge(r.scan_status)}
                <Badge variant="outline" className="text-[10px]">
                  {r.file_count} file{r.file_count === 1 ? "" : "s"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {r.price_fils == null ? "Free / TBD" : formatFils(r.price_fils)}
                </Badge>
              </div>
              {actionsFor(r)}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resource</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Readiness</TableHead>
                <TableHead>Scan</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-[280px]">
                    <div className="font-medium text-dark-base break-words">
                      {r.title_en || r.slug}
                    </div>
                    <div className="text-[11px] text-muted-foreground break-words">{r.slug}</div>
                  </TableCell>
                  <TableCell className="capitalize text-xs">{r.type.replace("_", " ")}</TableCell>
                  <TableCell className="text-xs">
                    {r.current_version_label ?? <span className="text-muted-foreground">none</span>}
                    <div className="text-[10px] text-muted-foreground">
                      {r.file_count} file{r.file_count === 1 ? "" : "s"}
                    </div>
                  </TableCell>
                  <TableCell>{renderReadiness(r)}</TableCell>
                  <TableCell>{scanBadge(r.scan_status)}</TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {r.price_fils == null ? (
                      <span className="text-muted-foreground">Free / TBD</span>
                    ) : (
                      formatFils(r.price_fils)
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(r.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">{actionsFor(r)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} total
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              disabled={page <= 1}
              onClick={() => updateParam("page", String(page - 1))}
            >
              Previous
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
      ) : null}

      <PublishingQueueDetailSheet
        open={!!detailRow}
        onOpenChange={(o) => { if (!o) setDetailRow(null); }}
        row={detailRow}
      />
    </div>
  );
}

export default PublishingQueue;

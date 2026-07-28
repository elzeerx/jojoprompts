import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ClipboardCheck,
  ExternalLink,
  GitBranch,
  Loader2,
  MoreHorizontal,
  Pencil,
  Rows,
  Save,
  Search,
  Send,
  LayoutGrid,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { isTransitionAllowed } from "@/lib/v2/admin/lifecycleTransitions";
import { computeBulkEligibility } from "@/lib/v2/admin/bulkLifecycleEligibility";

type ResourceType =
  | "skill" | "automation" | "prompt" | "prompt_pack" | "image_style" | "bundle";
type Lifecycle = "draft" | "review" | "published" | "archived";
type ScanStatus = "clean" | "pending" | "suspicious" | "malicious" | "failed" | "none";
type ViewMode = "table" | "card";

const RESOURCE_TYPES: { value: ResourceType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "skill", label: "Skill" },
  { value: "automation", label: "Automation" },
  { value: "prompt", label: "Prompt" },
  { value: "prompt_pack", label: "Prompt pack" },
  { value: "image_style", label: "Image style" },
  { value: "bundle", label: "Bundle" },
];

const STATUSES: { value: Lifecycle | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "In review" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const SCAN_FILTERS: { value: ScanStatus | "all"; label: string }[] = [
  { value: "all", label: "Any scan" },
  { value: "clean", label: "Clean" },
  { value: "pending", label: "Pending" },
  { value: "suspicious", label: "Suspicious" },
  { value: "malicious", label: "Malicious" },
  { value: "failed", label: "Failed" },
  { value: "none", label: "Unscanned" },
];

const sel = (s: string): string => s;

interface Row {
  id: string; slug: string; type: ResourceType; lifecycle: Lifecycle;
  title_en: string | null; title_ar: string | null;
  updated_at: string; published_at: string | null; archived_at: string | null;
  current_version_id: string | null;
  current_version: { id: string; version: string; major_version: number } | null;
  platform_compatibility: { platform_slug: string; is_verified: boolean }[];
}
interface Extras {
  price_fils: Map<string, number | null>;
  in_bundle: Set<string>;
  scan_status: Map<string, ScanStatus>;
}
interface FetchArgs {
  page: number; pageSize: number; search: string;
  type: ResourceType | "all"; status: Lifecycle | "all";
  platformSlug: string | "all"; scan: ScanStatus | "all";
  sortBy: "updated_at" | "published_at" | "title_en";
  sortDir: "asc" | "desc"; lockedType?: ResourceType;
  includeTypes?: ResourceType[];
}

interface PlatformOpt { slug: string; name: string }

async function fetchPlatforms(): Promise<PlatformOpt[]> {
  const { data, error } = await (supabase as any)
    .from("platforms")
    .select("slug,name,display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) return [];
  return (data ?? []).map((p: any) => ({ slug: p.slug, name: p.name }));
}

async function fetchCatalog(a: FetchArgs): Promise<{ rows: Row[]; total: number; extras: Extras }> {
  const from = (a.page - 1) * a.pageSize;
  const to = from + a.pageSize - 1;

  let q = (supabase as any)
    .from("resources")
    .select(
      sel(
        "id, slug, type, lifecycle, title_en, title_ar, updated_at, published_at, archived_at, current_version_id, current_version:current_version_id ( id, version, major_version ), platform_compatibility ( platform_slug, is_verified )",
      ),
      { count: "exact" },
    );

  if (a.lockedType) {
    q = q.eq("type", a.lockedType);
  } else if (a.includeTypes && a.includeTypes.length > 0) {
    q = q.in("type", a.includeTypes);
  } else if (a.type !== "all") {
    q = q.eq("type", a.type);
  }
  if (a.status !== "all") q = q.eq("lifecycle", a.status);
  if (a.search.trim()) {
    const s = a.search.trim().replace(/[,()]/g, "");
    q = q.or(`title_en.ilike.%${s}%,title_ar.ilike.%${s}%,slug.ilike.%${s}%`);
  }
  q = q.order(a.sortBy, { ascending: a.sortDir === "asc", nullsFirst: false }).range(from, to);

  const { data, count, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as Row[];

  // Platform filter is client-side over the fetched page — the schema stores
  // compatibility in a joined child table so server-side filtering here would
  // require an RPC. Documented tradeoff for Phase 1.
  if (a.platformSlug !== "all") {
    rows = rows.filter((r) =>
      (r.platform_compatibility ?? []).some((p) => p.platform_slug === a.platformSlug),
    );
  }

  const ids = rows.map((r) => r.id);
  const versionIds = rows.map((r) => r.current_version_id).filter(Boolean) as string[];

  const extras: Extras = { price_fils: new Map(), in_bundle: new Set(), scan_status: new Map() };

  if (ids.length > 0) {
    const [products, bundleItems, scans] = await Promise.all([
      (supabase as any)
        .from("products")
        .select(sel("resource_id, price_fils, product_type, is_active"))
        .in("resource_id", ids)
        .eq("is_active", true),
      (supabase as any)
        .from("product_bundle_items")
        .select(sel("resource_id"))
        .in("resource_id", ids),
      versionIds.length > 0
        ? (supabase as any)
            .from("package_scans")
            .select(sel("resource_version_id, status, created_at, scanned_at"))
            .in("resource_version_id", versionIds)
            .order("created_at", { ascending: false })
            .order("scanned_at", { ascending: false, nullsFirst: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    ((products as any).data ?? []).forEach((p: any) => {
      const cur = extras.price_fils.get(p.resource_id);
      if (cur == null || (p.price_fils ?? 0) < cur) {
        extras.price_fils.set(p.resource_id, p.price_fils ?? 0);
      }
    });
    ((bundleItems as any).data ?? []).forEach((b: any) => extras.in_bundle.add(b.resource_id));

    const versionScan = new Map<string, ScanStatus>();
    ((scans as any).data ?? []).forEach((s: any) => {
      if (!versionScan.has(s.resource_version_id)) versionScan.set(s.resource_version_id, s.status);
    });
    rows.forEach((r) => {
      if (r.current_version_id) {
        extras.scan_status.set(r.id, versionScan.get(r.current_version_id) ?? "none");
      } else {
        extras.scan_status.set(r.id, "none");
      }
    });
  }

  // Scan filter — client-side on the same page for consistency with platform filter.
  if (a.scan !== "all") {
    const wanted = a.scan;
    rows = rows.filter((r) => (extras.scan_status.get(r.id) ?? "none") === wanted);
  }

  return { rows, total: count ?? 0, extras };
}

// Saved views (per-user, per-lockedType) in localStorage.
interface SavedView {
  name: string;
  filters: {
    search: string; type: ResourceType | "all"; status: Lifecycle | "all";
    platformSlug: string | "all"; scan: ScanStatus | "all";
    sortBy: FetchArgs["sortBy"]; sortDir: FetchArgs["sortDir"]; view: ViewMode;
  };
}
const SAVED_VIEWS_KEY = "admin:v2:catalog:savedViews";
function loadSavedViews(scope: string): SavedView[] {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Record<string, SavedView[]>;
    return all[scope] ?? [];
  } catch { return []; }
}
function persistSavedViews(scope: string, views: SavedView[]) {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    const all: Record<string, SavedView[]> = raw ? JSON.parse(raw) : {};
    all[scope] = views;
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

interface Props {
  lockedType?: ResourceType;
  includeTypes?: ResourceType[];
  title: string;
  subtitle?: string;
}

export function CatalogTable({ lockedType, includeTypes, title, subtitle }: Props) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ResourceType | "all">("all");
  const [status, setStatus] = useState<Lifecycle | "all">("all");
  const [platformSlug, setPlatformSlug] = useState<string | "all">("all");
  const [scan, setScan] = useState<ScanStatus | "all">("all");
  const [sortBy, setSortBy] = useState<FetchArgs["sortBy"]>("updated_at");
  const [sortDir, setSortDir] = useState<FetchArgs["sortDir"]>("desc");
  const [view, setView] = useState<ViewMode>("table");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState<null | "publish" | "review" | "archive" | "restore">(null);
  const [rowConfirm, setRowConfirm] = useState<{ id: string; action: "publish" | "archive" } | null>(null);
  const [publishResult, setPublishResult] = useState<{ resourceId: string; errors: string[] } | null>(null);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const scope = lockedType ?? (includeTypes ? includeTypes.join("+") : "all");
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => loadSavedViews(scope));
  useEffect(() => { setSavedViews(loadSavedViews(scope)); }, [scope]);

  const { data: platforms = [] } = useQuery({
    queryKey: ["admin", "v2", "platforms"],
    queryFn: fetchPlatforms,
    staleTime: 60_000,
  });

  const queryKey = useMemo(
    () => ["admin","v2","catalog", {
      page, pageSize, search, type: lockedType ?? type, status,
      platformSlug, scan, sortBy, sortDir, includeTypes: includeTypes ?? null,
    }],
    [page, pageSize, search, type, status, platformSlug, scan, sortBy, sortDir, lockedType, includeTypes],
  );

  const { data, isLoading, isError, refetch, isFetching, error } = useQuery({
    queryKey,
    queryFn: () =>
      fetchCatalog({ page, pageSize, search, type, status, platformSlug, scan, sortBy, sortDir, lockedType, includeTypes }),
    staleTime: 15_000,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) rows.forEach((r) => next.delete(r.id));
    else rows.forEach((r) => next.add(r.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  // Server-validated actions
  const runPublish = useCallback(async (ids: string[]) => {
    const results = await Promise.all(ids.map(async (id) => {
      const { data, error } = await (supabase as any).rpc("admin_publish_resource", { p_resource_id: id });
      if (error) return { id, ok: false, errors: [error.message] };
      if (!(data as any)?.ok) return { id, ok: false, errors: ((data as any)?.errors ?? ["unknown"]) as string[] };
      return { id, ok: true, errors: [] as string[] };
    }));
    return results;
  }, []);
  const runTransition = useCallback(async (ids: string[], action: "review" | "archive" | "restore") => {
    return Promise.all(ids.map(async (id) => {
      const { data, error } = await (supabase as any).rpc("admin_transition_resource_lifecycle", {
        p_resource_id: id, p_action: action,
      });
      if (error) return { id, ok: false, errors: [error.message] };
      if (!(data as any)?.ok) return { id, ok: false, errors: ["failed"] };
      return { id, ok: true, errors: [] as string[] };
    }));
  }, []);

  const mutate = useMutation({
    mutationFn: async (args: { ids: string[]; action: "publish" | "review" | "archive" | "restore" }) => {
      if (args.action === "publish") return runPublish(args.ids);
      return runTransition(args.ids, args.action);
    },
    onSuccess: (results, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "catalog"] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "overview"] });
      const ok = results.filter((r) => r.ok).length;
      const fail = results.length - ok;
      if (fail === 0) {
        toast({ title: `Applied ${vars.action}`, description: `${ok} resource(s) updated.` });
      } else {
        const firstErr = results.find((r) => !r.ok);
        toast({
          variant: "destructive",
          title: `${vars.action} partially applied`,
          description: `${ok} ok, ${fail} failed. First error: ${firstErr?.errors?.[0] ?? "unknown"}`,
        });
        // For single-item publish, surface validation errors inline.
        if (vars.action === "publish" && vars.ids.length === 1 && firstErr) {
          setPublishResult({ resourceId: firstErr.id, errors: firstErr.errors });
        }
      }
      setSelected(new Set());
      setConfirmBulk(null);
      setRowConfirm(null);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Action failed", description: err?.message ?? "unknown" });
      setConfirmBulk(null);
      setRowConfirm(null);
    },
  });

  const renderScan = (v: ScanStatus | undefined) => {
    const tone: Record<string, string> = {
      clean: "bg-emerald-50 text-emerald-700 border-emerald-200",
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      suspicious: "bg-orange-50 text-orange-700 border-orange-200",
      malicious: "bg-red-50 text-red-700 border-red-200",
      failed: "bg-red-50 text-red-700 border-red-200",
      none: "",
    };
    const label = !v || v === "none" ? "Unscanned" : v;
    return <Badge variant="outline" className={`text-[10px] ${tone[v ?? "none"]}`}>{label}</Badge>;
  };

  const renderPrice = (id: string) => {
    const p = data?.extras.price_fils.get(id);
    const bundled = data?.extras.in_bundle.has(id);
    return (
      <div className="flex flex-col text-xs">
        {p != null ? (
          <span className="tabular-nums text-dark-base">
            {(p / 1000).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD
          </span>
        ) : (
          <span className="text-muted-foreground">Free / TBD</span>
        )}
        <span className="text-[10px] text-warm-gold">Included with Lifetime</span>
        {bundled ? <span className="text-[10px] text-muted-foreground">In bundle</span> : null}
      </div>
    );
  };

  const captureCurrentFilters = (): SavedView["filters"] => ({
    search, type, status, platformSlug, scan, sortBy, sortDir, view,
  });

  const applyView = (v: SavedView) => {
    setSearch(v.filters.search);
    setType(v.filters.type);
    setStatus(v.filters.status);
    setPlatformSlug(v.filters.platformSlug);
    setScan(v.filters.scan);
    setSortBy(v.filters.sortBy);
    setSortDir(v.filters.sortDir);
    setView(v.filters.view);
    setPage(1);
    setSavedViewsOpen(false);
  };

  const saveCurrentView = () => {
    const name = window.prompt("Save this view as:");
    if (!name) return;
    const next = [...savedViews.filter((s) => s.name !== name.trim()), { name: name.trim(), filters: captureCurrentFilters() }];
    setSavedViews(next);
    persistSavedViews(scope, next);
    toast({ title: "View saved", description: name });
  };

  const deleteView = (name: string) => {
    const next = savedViews.filter((s) => s.name !== name);
    setSavedViews(next);
    persistSavedViews(scope, next);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-dark-base sm:text-2xl">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {subtitle ?? (lockedType
              ? `Locked type: ${lockedType}. Manage lifecycle, versions, and trust state.`
              : "Unified catalog across skills, automations, prompts, image styles, and bundles.")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" className="min-h-[44px] bg-warm-gold text-dark-base hover:bg-warm-gold/90">
            <Link to="/admin/publishing/new">New Resource</Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by title or slug"
            className="ps-9 min-h-[44px]"
            aria-label="Search catalog"
          />
        </div>
        {!lockedType && !includeTypes ? (
          <Select value={type} onValueChange={(v) => { setType(v as any); setPage(1); }}>
            <SelectTrigger className="min-h-[44px] w-[160px]" aria-label="Type filter"><SelectValue /></SelectTrigger>
            <SelectContent>{RESOURCE_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
          </Select>
        ) : null}
        <Select value={status} onValueChange={(v) => { setStatus(v as any); setPage(1); }}>
          <SelectTrigger className="min-h-[44px] w-[160px]" aria-label="Status filter"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
        </Select>
        <Select value={platformSlug} onValueChange={(v) => { setPlatformSlug(v); setPage(1); }}>
          <SelectTrigger className="min-h-[44px] w-[160px]" aria-label="Platform filter"><SelectValue placeholder="All platforms" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {platforms.map((p) => (<SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={scan} onValueChange={(v) => { setScan(v as ScanStatus); setPage(1); }}>
          <SelectTrigger className="min-h-[44px] w-[150px]" aria-label="Scan filter"><SelectValue /></SelectTrigger>
          <SelectContent>{SCAN_FILTERS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
        </Select>
        <Select
          value={`${sortBy}:${sortDir}`}
          onValueChange={(v) => {
            const [b, d] = v.split(":") as [FetchArgs["sortBy"], FetchArgs["sortDir"]];
            setSortBy(b); setSortDir(d);
          }}
        >
          <SelectTrigger className="min-h-[44px] w-[180px]" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_at:desc">Recently updated</SelectItem>
            <SelectItem value="updated_at:asc">Oldest updated</SelectItem>
            <SelectItem value="published_at:desc">Recently published</SelectItem>
            <SelectItem value="title_en:asc">Title A→Z</SelectItem>
            <SelectItem value="title_en:desc">Title Z→A</SelectItem>
          </SelectContent>
        </Select>

        <div className="ms-auto flex items-center gap-2">
          <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5">
            <Button
              size="icon"
              variant={view === "table" ? "secondary" : "ghost"}
              className="h-10 w-10"
              aria-label="Table view"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
            >
              <Rows className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              size="icon"
              variant={view === "card" ? "secondary" : "ghost"}
              className="h-10 w-10"
              aria-label="Card view"
              aria-pressed={view === "card"}
              onClick={() => setView("card")}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <Button
            type="button" size="sm" variant="outline" className="min-h-[44px]"
            onClick={() => setSavedViewsOpen(true)}
          >
            Saved views ({savedViews.length})
          </Button>
          <Button
            type="button" size="sm" variant="outline" className="min-h-[44px]"
            onClick={saveCurrentView}
          >
            <Save className="me-1.5 h-3.5 w-3.5" aria-hidden /> Save view
          </Button>
        </div>
      </div>

      {selected.size > 0 ? (() => {
        const visible = rows.map((r) => ({ id: r.id, lifecycle: r.lifecycle as any }));
        const elig = {
          review:  computeBulkEligibility(selected, visible, "review"),
          publish: computeBulkEligibility(selected, visible, "publish"),
          archive: computeBulkEligibility(selected, visible, "archive"),
          restore: computeBulkEligibility(selected, visible, "restore"),
        };
        return (
          <div role="region" aria-label="Bulk actions" className="flex flex-wrap items-center gap-2 rounded-md border border-warm-gold/40 bg-warm-gold/10 px-3 py-2">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <div className="ms-auto flex flex-wrap gap-2">
              <Button
                size="sm" variant="outline" className="min-h-[44px]"
                disabled={elig.review.eligibleCount === 0}
                onClick={() => setConfirmBulk("review")}
                aria-label={`Submit for review (${elig.review.eligibleCount} eligible, ${elig.review.skippedCount} skipped)`}
              >
                <ClipboardCheck className="me-1 h-3.5 w-3.5" aria-hidden /> Submit for review ({elig.review.eligibleCount})
              </Button>
              <Button
                size="sm" variant="outline" className="min-h-[44px]"
                disabled={elig.publish.eligibleCount === 0}
                onClick={() => setConfirmBulk("publish")}
                aria-label={`Publish (${elig.publish.eligibleCount} eligible, ${elig.publish.skippedCount} skipped)`}
              >
                <Send className="me-1 h-3.5 w-3.5" aria-hidden /> Publish ({elig.publish.eligibleCount})
              </Button>
              <Button
                size="sm" variant="outline" className="min-h-[44px] text-red-700 hover:text-red-800"
                disabled={elig.archive.eligibleCount === 0}
                onClick={() => setConfirmBulk("archive")}
                aria-label={`Archive (${elig.archive.eligibleCount} eligible, ${elig.archive.skippedCount} skipped)`}
              >
                <Archive className="me-1 h-3.5 w-3.5" aria-hidden /> Archive ({elig.archive.eligibleCount})
              </Button>
              {elig.restore.eligibleCount > 0 ? (
                <Button
                  size="sm" variant="outline" className="min-h-[44px]"
                  onClick={() => setConfirmBulk("restore")}
                  aria-label={`Restore to draft (${elig.restore.eligibleCount} eligible, ${elig.restore.skippedCount} skipped)`}
                >
                  <ClipboardCheck className="me-1 h-3.5 w-3.5" aria-hidden /> Restore to draft ({elig.restore.eligibleCount})
                </Button>
              ) : null}
            </div>
          </div>
        );
      })() : null}

      {view === "table" ? (
        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full min-w-[960px] border-collapse text-sm" aria-busy={isFetching} aria-label="V2 catalog">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="w-12 px-1 py-2">
                  <label className="mx-auto flex h-11 w-11 md:h-5 md:w-5 cursor-pointer items-center justify-center" aria-label="Select all on page">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all on page" className="md:h-5 md:w-5" />
                  </label>
                </th>
                <th className="px-3 py-2">Resource</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Platforms</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Price / inclusion</th>
                <th className="px-3 py-2">Scan</th>
                <th className="px-3 py-2">Updated</th>
                <th className="w-12 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td key={j} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-sm">
                    Failed to load catalog: {(error as any)?.message ?? ""}{" "}
                    <Button variant="link" size="sm" onClick={() => refetch()}>Retry</Button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="p-10 text-center text-sm text-muted-foreground">No resources match these filters.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="px-1 py-2 align-top">
                    <label className="mx-auto flex h-11 w-11 md:h-5 md:w-5 cursor-pointer items-center justify-center" aria-label={`Select ${r.title_en ?? r.slug}`}>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={`Select ${r.title_en ?? r.slug}`} className="md:h-5 md:w-5" />
                    </label>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col">
                      <span className="font-medium text-dark-base">{r.title_en ?? r.slug}</span>
                      <span className="text-[11px] text-muted-foreground">/{r.slug}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top"><Badge variant="secondary" className="text-[10px]">{r.type}</Badge></td>
                  <td className="px-3 py-2 align-top">
                    <Badge variant="outline" className={`text-[10px] ${
                      r.lifecycle === "published" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : r.lifecycle === "review" ? "border-amber-200 bg-amber-50 text-amber-700"
                      : r.lifecycle === "archived" ? "border-gray-200 bg-gray-50 text-gray-600"
                      : "border-blue-200 bg-blue-50 text-blue-700"
                    }`}>{r.lifecycle}</Badge>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-1">
                      {(r.platform_compatibility ?? []).slice(0, 4).map((p, i) => (
                        <Badge key={`${p.platform_slug}:${i}`} variant="outline" className="text-[10px]" title={p.is_verified ? "Verified" : "Unverified"}>
                          {p.platform_slug}{p.is_verified ? " ✓" : ""}
                        </Badge>
                      ))}
                      {(r.platform_compatibility?.length ?? 0) === 0 ? <span className="text-[11px] text-muted-foreground">—</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {r.current_version ? <span className="text-xs tabular-nums">v{r.current_version.version}</span> : <span className="text-[11px] text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 align-top">{renderPrice(r.id)}</td>
                  <td className="px-3 py-2 align-top">{renderScan(data?.extras.scan_status.get(r.id))}</td>
                  <td className="px-3 py-2 align-top text-xs tabular-nums text-muted-foreground">{new Date(r.updated_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 align-top">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-11 w-11" aria-label={`Row actions for ${r.title_en ?? r.slug}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><Link to={`/resources/${r.slug}`}><ExternalLink className="me-2 h-3.5 w-3.5" /> View public</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link to={`/admin/publishing/resources/${r.id}/edit`}><Pencil className="me-2 h-3.5 w-3.5" /> Edit</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link to={`/admin/publishing/resources/${r.id}/versions/new`}><GitBranch className="me-2 h-3.5 w-3.5" /> New version</Link></DropdownMenuItem>
                        {isTransitionAllowed(r.lifecycle, "review") ? (
                          <DropdownMenuItem onSelect={() => mutate.mutate({ ids: [r.id], action: "review" })}>
                            <ClipboardCheck className="me-2 h-3.5 w-3.5" /> Submit for review
                          </DropdownMenuItem>
                        ) : null}
                        {isTransitionAllowed(r.lifecycle, "publish") ? (
                          <DropdownMenuItem onSelect={() => setRowConfirm({ id: r.id, action: "publish" })}>
                            <Send className="me-2 h-3.5 w-3.5" /> Publish…
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        {isTransitionAllowed(r.lifecycle, "archive") ? (
                          <DropdownMenuItem className="text-red-700 focus:text-red-800" onSelect={() => setRowConfirm({ id: r.id, action: "archive" })}>
                            <Archive className="me-2 h-3.5 w-3.5" /> Archive…
                          </DropdownMenuItem>
                        ) : null}
                        {isTransitionAllowed(r.lifecycle, "restore") ? (
                          <DropdownMenuItem onSelect={() => mutate.mutate({ ids: [r.id], action: "restore" })}>
                            <ArchiveRestore className="me-2 h-3.5 w-3.5" /> Restore to draft
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem asChild><Link to={`/admin/trust/admin-activity?target=${r.id}`}><ClipboardCheck className="me-2 h-3.5 w-3.5" /> Activity</Link></DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
            : rows.map((r) => (
                <div key={r.id} className="flex flex-col justify-between rounded-md border border-gray-200 bg-white p-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <Badge variant="secondary" className="text-[10px]">{r.type}</Badge>
                      {renderScan(data?.extras.scan_status.get(r.id))}
                    </div>
                    <div className="font-medium text-dark-base">{r.title_en ?? r.slug}</div>
                    <div className="text-[11px] text-muted-foreground">/{r.slug}</div>
                    <div className="mt-2">{renderPrice(r.id)}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline" className="min-h-[44px]">
                      <Link to={`/admin/publishing/resources/${r.id}/edit`}><Pencil className="me-1 h-3.5 w-3.5" /> Edit</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="min-h-[44px]">
                      <Link to={`/resources/${r.slug}`}><ExternalLink className="me-1 h-3.5 w-3.5" /> View</Link>
                    </Button>
                  </div>
                </div>
              ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-muted-foreground">
          {isLoading ? "Loading…" : `${total.toLocaleString()} resources · page ${page} of ${totalPages}`}
          {isFetching && !isLoading ? <Loader2 className="ms-2 inline h-3 w-3 animate-spin" /> : null}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="min-h-[44px]" disabled={page <= 1 || isLoading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
          <Button size="sm" variant="outline" className="min-h-[44px]" disabled={page >= totalPages || isLoading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
        </div>
      </div>

      {/* Row confirmation */}
      <AlertDialog open={!!rowConfirm} onOpenChange={(v) => (v ? null : setRowConfirm(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm {rowConfirm?.action} for this resource?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {rowConfirm?.action === "archive"
                ? "Archived resources are hidden from the public catalog. Downloads are blocked. Recoverable from Archived filter."
                : "Publication runs server-side validation. It will fail with actionable errors if required fields, packages, scans, platform compatibility, or an active product are missing."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => rowConfirm && mutate.mutate({ ids: [rowConfirm.id], action: rowConfirm.action })} disabled={mutate.isPending}>
              {mutate.isPending ? <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" /> : null} Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk confirmation */}
      <AlertDialog open={!!confirmBulk} onOpenChange={(v) => (v ? null : setConfirmBulk(null))}>
        <AlertDialogContent>
          {(() => {
            const visible = rows.map((r) => ({ id: r.id, lifecycle: r.lifecycle as any }));
            const e = confirmBulk
              ? computeBulkEligibility(selected, visible, confirmBulk)
              : { eligibleIds: [], eligibleCount: 0, skippedCount: 0, totalSelected: selected.size };
            const actionLabel =
              confirmBulk === "restore" ? "Restore to draft"
              : confirmBulk === "review" ? "Submit for review"
              : confirmBulk === "publish" ? "Publish"
              : confirmBulk === "archive" ? "Archive"
              : "";
            const body =
              confirmBulk === "archive"
                ? "Archived resources are hidden from the public catalog. Recoverable via Restore."
                : confirmBulk === "publish"
                ? "Each resource runs server-side publish validation. Partial-success is reported per row."
                : confirmBulk === "restore"
                ? "Restore returns archived resources to draft. It does not republish."
                : "Submits selected resources to the review queue.";
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>{actionLabel}: {e.eligibleCount} eligible</AlertDialogTitle>
                  <AlertDialogDescription>
                    {body}
                    <br />
                    <span className="text-xs">
                      {e.eligibleCount} of {e.totalSelected} selected will be affected.
                      {e.skippedCount > 0 ? ` ${e.skippedCount} skipped (invalid state for this action).` : ""}
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => confirmBulk && e.eligibleCount > 0 && mutate.mutate({ ids: e.eligibleIds, action: confirmBulk })}
                    disabled={mutate.isPending || e.eligibleCount === 0}
                    className="min-h-[44px]"
                  >
                    {mutate.isPending ? <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" /> : null} Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Publish validation errors */}
      <Dialog open={!!publishResult} onOpenChange={(v) => (v ? null : setPublishResult(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish blocked</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Server-side validation rejected this resource. Address each item below in the publisher and try again.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
            {(publishResult?.errors ?? []).map((e, i) => <li key={i} className="font-mono text-xs">{e}</li>)}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishResult(null)}>Close</Button>
            {publishResult ? (
              <Button asChild><Link to={`/admin/publishing/resources/${publishResult.resourceId}/edit`}>Open publisher</Link></Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved views */}
      <Dialog open={savedViewsOpen} onOpenChange={setSavedViewsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saved views</DialogTitle>
          </DialogHeader>
          {savedViews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved views yet. Use “Save view” to store the current filters.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {savedViews.map((v) => (
                <li key={v.name} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium">{v.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {v.filters.type} · {v.filters.status} · {v.filters.platformSlug} · {v.filters.scan} · {v.filters.sortBy}:{v.filters.sortDir}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="min-h-[40px]" onClick={() => applyView(v)}>Load</Button>
                    <Button size="sm" variant="ghost" className="min-h-[40px] text-red-700" onClick={() => deleteView(v.name)}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <DropdownMenu>
            <DropdownMenuLabel />
          </DropdownMenu>
        </DialogContent>
      </Dialog>
    </div>
  );
}

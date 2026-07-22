import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  GitBranch,
  ClipboardCheck,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

type ResourceType =
  | "skill"
  | "automation"
  | "prompt"
  | "prompt_pack"
  | "image_style"
  | "bundle";

type Lifecycle = "draft" | "review" | "published" | "archived";

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

// Untype the select string so TS does not parse it (perf).
const sel = (s: string): string => s;

interface Row {
  id: string;
  slug: string;
  type: ResourceType;
  lifecycle: Lifecycle;
  title_en: string | null;
  title_ar: string | null;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
  current_version_id: string | null;
  current_version: { id: string; version: string; major_version: number } | null;
  platform_compatibility: { platform_slug: string; is_verified: boolean }[];
}

interface Extras {
  price_fils: Map<string, number | null>;
  in_bundle: Set<string>;
  scan_status: Map<string, "clean" | "pending" | "suspicious" | "malicious" | "failed" | null>;
}

interface FetchArgs {
  page: number;
  pageSize: number;
  search: string;
  type: ResourceType | "all";
  status: Lifecycle | "all";
  sortBy: "updated_at" | "published_at" | "title_en";
  sortDir: "asc" | "desc";
  lockedType?: ResourceType;
}

async function fetchCatalog(a: FetchArgs): Promise<{ rows: Row[]; total: number; extras: Extras }> {
  const from = (a.page - 1) * a.pageSize;
  const to = from + a.pageSize - 1;

  let q = supabase
    .from("resources")
    .select(
      sel(
        "id, slug, type, lifecycle, title_en, title_ar, updated_at, published_at, archived_at, current_version_id, current_version:current_version_id ( id, version, major_version ), platform_compatibility ( platform_slug, is_verified )",
      ),
      { count: "exact" },
    );

  const effectiveType = a.lockedType ?? (a.type === "all" ? null : a.type);
  if (effectiveType) q = q.eq("type", effectiveType);
  if (a.status !== "all") q = q.eq("lifecycle", a.status);
  if (a.search.trim()) {
    const s = a.search.trim().replace(/[,()]/g, "");
    q = q.or(`title_en.ilike.%${s}%,title_ar.ilike.%${s}%,slug.ilike.%${s}%`);
  }
  q = q.order(a.sortBy, { ascending: a.sortDir === "asc", nullsFirst: false }).range(from, to);

  const { data, count, error } = await q.returns<Row[]>();
  if (error) throw error;
  const rows = data ?? [];

  const ids = rows.map((r) => r.id);
  const versionIds = rows.map((r) => r.current_version_id).filter(Boolean) as string[];

  const extras: Extras = {
    price_fils: new Map(),
    in_bundle: new Set(),
    scan_status: new Map(),
  };

  if (ids.length > 0) {
    const [products, bundleItems, scans] = await Promise.all([
      supabase
        .from("products")
        .select(sel("resource_id, price_fils, product_type, is_active"))
        .in("resource_id", ids)
        .eq("is_active", true)
        .returns<{ resource_id: string; price_fils: number; product_type: string; is_active: boolean }[]>(),
      supabase
        .from("product_bundle_items")
        .select(sel("resource_id"))
        .in("resource_id", ids)
        .returns<{ resource_id: string }[]>(),
      versionIds.length > 0
        ? supabase
            .from("package_scans")
            .select(sel("resource_version_id, status, scanned_at"))
            .in("resource_version_id", versionIds)
            .order("scanned_at", { ascending: false })
            .returns<{ resource_version_id: string; status: any; scanned_at: string }[]>()
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    (products.data ?? []).forEach((p) => {
      // Cheapest active individual/lifetime product per resource.
      const cur = extras.price_fils.get(p.resource_id);
      if (cur == null || (p.price_fils ?? 0) < cur) {
        extras.price_fils.set(p.resource_id, p.price_fils ?? 0);
      }
    });
    (bundleItems.data ?? []).forEach((b) => extras.in_bundle.add(b.resource_id));

    // Map latest scan per version → back to resource.
    const versionScan = new Map<string, Row["current_version"] extends null ? never : any>();
    (scans.data ?? []).forEach((s: any) => {
      if (!versionScan.has(s.resource_version_id)) versionScan.set(s.resource_version_id, s.status);
    });
    rows.forEach((r) => {
      if (r.current_version_id) {
        extras.scan_status.set(r.id, versionScan.get(r.current_version_id) ?? null);
      }
    });
  }

  return { rows, total: count ?? 0, extras };
}

const SAVED_VIEWS_KEY = "admin:catalog:savedViews";

interface Props {
  lockedType?: ResourceType;
  title: string;
}

export function CatalogTable({ lockedType, title }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<ResourceType | "all">("all");
  const [status, setStatus] = useState<Lifecycle | "all">("all");
  const [sortBy, setSortBy] = useState<FetchArgs["sortBy"]>("updated_at");
  const [sortDir, setSortDir] = useState<FetchArgs["sortDir"]>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState<null | "publish" | "review" | "archive">(null);

  const queryKey = useMemo(
    () => [
      "admin",
      "v2",
      "catalog",
      { page, pageSize, search, type: lockedType ?? type, status, sortBy, sortDir },
    ],
    [page, pageSize, search, type, status, sortBy, sortDir, lockedType],
  );

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      fetchCatalog({ page, pageSize, search, type, status, sortBy, sortDir, lockedType }),
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

  const mutate = useMutation({
    mutationFn: async (args: { ids: string[]; action: "publish" | "review" | "archive" | "restore" }) => {
      const patch: Record<string, unknown> = {};
      switch (args.action) {
        case "publish":
          patch.lifecycle = "published";
          patch.published_at = new Date().toISOString();
          patch.archived_at = null;
          break;
        case "review":
          patch.lifecycle = "review";
          break;
        case "archive":
          patch.lifecycle = "archived";
          patch.archived_at = new Date().toISOString();
          break;
        case "restore":
          patch.lifecycle = "draft";
          patch.archived_at = null;
          break;
      }
      // Per-id updates so RLS denials or errors report per row.
      const results = await Promise.all(
        args.ids.map(async (id) => {
          const { error } = await (supabase as any).from("resources").update(patch).eq("id", id);
          return { id, ok: !error, error: error?.message ?? null };
        }),
      );
      // Best-effort activity log; ignore failure.
      if (user) {
        await (supabase as any)
          .from("activity_events")
          .insert(
            args.ids.map((id) => ({
              actor_user_id: user.id,
              actor_type: "admin",
              action: `resource.${args.action}`,
              entity_type: "resource",
              entity_id: id,
            })),
          )
          .then(() => undefined, () => undefined);
      }
      return results;
    },
    onSuccess: (results, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "v2", "catalog"] });
      qc.invalidateQueries({ queryKey: ["admin", "v2", "overview"] });
      const ok = results.filter((r) => r.ok).length;
      const fail = results.length - ok;
      if (fail === 0) {
        toast({ title: `Applied ${vars.action}`, description: `${ok} resource(s) updated.` });
      } else {
        toast({
          variant: "destructive",
          title: `${vars.action} partially applied`,
          description: `${ok} ok, ${fail} failed. First error: ${results.find((r) => !r.ok)?.error ?? "unknown"}`,
        });
      }
      setSelected(new Set());
      setConfirmBulk(null);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Bulk action failed", description: err?.message ?? "unknown" });
      setConfirmBulk(null);
    },
  });

  const applyBulk = (action: "publish" | "review" | "archive") =>
    mutate.mutate({ ids: Array.from(selected), action });

  const renderScan = (v: string | null | undefined) => {
    if (!v)
      return (
        <Badge variant="outline" className="text-[10px]">
          Unscanned
        </Badge>
      );
    const tone: Record<string, string> = {
      clean: "bg-emerald-50 text-emerald-700 border-emerald-200",
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      suspicious: "bg-orange-50 text-orange-700 border-orange-200",
      malicious: "bg-red-50 text-red-700 border-red-200",
      failed: "bg-red-50 text-red-700 border-red-200",
    };
    return (
      <Badge variant="outline" className={`text-[10px] ${tone[v] ?? ""}`}>
        {v}
      </Badge>
    );
  };

  const renderPrice = (id: string) => {
    const p = data?.extras.price_fils.get(id);
    const bundled = data?.extras.in_bundle.has(id);
    if (p == null && !bundled)
      return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <div className="flex flex-col text-xs">
        {p != null ? (
          <span className="tabular-nums text-dark-base">
            {(p / 1000).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} KWD
          </span>
        ) : null}
        {bundled ? <span className="text-[10px] text-warm-gold">Lifetime + Bundle</span> : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-dark-base sm:text-2xl">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {lockedType
              ? `Locked type: ${lockedType}. Manage lifecycle, versions, and trust state.`
              : "Unified catalog across skills, automations, prompts, image styles, and bundles."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            asChild
            size="sm"
            className="min-h-[40px] bg-warm-gold text-dark-base hover:bg-warm-gold/90"
          >
            <Link to="/admin/publishing/imports">New Resource</Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title or slug"
            className="ps-9 min-h-[44px]"
            aria-label="Search catalog"
          />
        </div>
        {!lockedType ? (
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v as any);
              setPage(1);
            }}
          >
            <SelectTrigger className="min-h-[44px] w-[160px]" aria-label="Type filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOURCE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as any);
            setPage(1);
          }}
        >
          <SelectTrigger className="min-h-[44px] w-[160px]" aria-label="Status filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={`${sortBy}:${sortDir}`}
          onValueChange={(v) => {
            const [b, d] = v.split(":") as [FetchArgs["sortBy"], FetchArgs["sortDir"]];
            setSortBy(b);
            setSortDir(d);
          }}
        >
          <SelectTrigger className="min-h-[44px] w-[180px]" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_at:desc">Recently updated</SelectItem>
            <SelectItem value="updated_at:asc">Oldest updated</SelectItem>
            <SelectItem value="published_at:desc">Recently published</SelectItem>
            <SelectItem value="title_en:asc">Title A→Z</SelectItem>
            <SelectItem value="title_en:desc">Title Z→A</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[40px]"
          onClick={() => {
            try {
              const raw = localStorage.getItem(SAVED_VIEWS_KEY);
              const views = raw ? JSON.parse(raw) : {};
              const key = prompt("Save this view as (name):");
              if (!key) return;
              views[key] = { search, type, status, sortBy, sortDir, lockedType };
              localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
              toast({ title: "View saved", description: key });
            } catch (err: any) {
              toast({ variant: "destructive", title: "Save failed", description: err?.message ?? "" });
            }
          }}
        >
          Save view
        </Button>
      </div>

      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 rounded-md border border-warm-gold/40 bg-warm-gold/10 px-3 py-2"
        >
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ms-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="min-h-[36px]" onClick={() => setConfirmBulk("review")}>
              <ClipboardCheck className="me-1 h-3.5 w-3.5" /> Submit for review
            </Button>
            <Button size="sm" variant="outline" className="min-h-[36px]" onClick={() => setConfirmBulk("publish")}>
              <Send className="me-1 h-3.5 w-3.5" /> Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-[36px] text-red-700 hover:text-red-800"
              onClick={() => setConfirmBulk("archive")}
            >
              <Archive className="me-1 h-3.5 w-3.5" /> Archive
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
        <table
          className="w-full min-w-[900px] border-collapse text-sm"
          aria-busy={isFetching}
          aria-label="V2 catalog"
        >
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="w-8 px-3 py-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all on page"
                />
              </th>
              <th className="px-3 py-2">Resource</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Platforms</th>
              <th className="px-3 py-2">Version</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Scan</th>
              <th className="px-3 py-2">Updated</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b">
                  {Array.from({ length: 10 }).map((__, j) => (
                    <td key={j} className="px-3 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-sm">
                  Failed to load catalog.{" "}
                  <Button variant="link" size="sm" onClick={() => refetch()}>
                    Retry
                  </Button>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-10 text-center text-sm text-muted-foreground">
                  No resources match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2 align-top">
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggleOne(r.id)}
                      aria-label={`Select ${r.title_en ?? r.slug}`}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col">
                      <span className="font-medium text-dark-base">{r.title_en ?? r.slug}</span>
                      <span className="text-[11px] text-muted-foreground">/{r.slug}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Badge variant="secondary" className="text-[10px]">
                      {r.type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        r.lifecycle === "published"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : r.lifecycle === "review"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : r.lifecycle === "archived"
                          ? "border-gray-200 bg-gray-50 text-gray-600"
                          : "border-blue-200 bg-blue-50 text-blue-700"
                      }`}
                    >
                      {r.lifecycle}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-1">
                      {r.platform_compatibility?.slice(0, 4).map((p, i) => (
                        <Badge
                          key={`${p.platform_slug}:${i}`}
                          variant="outline"
                          className="text-[10px]"
                          title={p.is_verified ? "Verified" : "Unverified"}
                        >
                          {p.platform_slug}
                          {p.is_verified ? " ✓" : ""}
                        </Badge>
                      )) ?? null}
                      {(r.platform_compatibility?.length ?? 0) === 0 ? (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {r.current_version ? (
                      <span className="text-xs tabular-nums">v{r.current_version.version}</span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">{renderPrice(r.id)}</td>
                  <td className="px-3 py-2 align-top">{renderScan(data?.extras.scan_status.get(r.id) ?? null)}</td>
                  <td className="px-3 py-2 align-top text-xs tabular-nums text-muted-foreground">
                    {new Date(r.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9"
                          aria-label={`Row actions for ${r.title_en ?? r.slug}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/resources/${r.slug}`}>
                            <ExternalLink className="me-2 h-3.5 w-3.5" /> View public
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/publishing/imports?resource=${r.id}`}>
                            <Pencil className="me-2 h-3.5 w-3.5" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/publishing/versions?resource=${r.id}`}>
                            <GitBranch className="me-2 h-3.5 w-3.5" /> New version
                          </Link>
                        </DropdownMenuItem>
                        {r.lifecycle !== "review" ? (
                          <DropdownMenuItem
                            onSelect={() => mutate.mutate({ ids: [r.id], action: "review" })}
                          >
                            <ClipboardCheck className="me-2 h-3.5 w-3.5" /> Submit for review
                          </DropdownMenuItem>
                        ) : null}
                        {r.lifecycle !== "published" ? (
                          <DropdownMenuItem
                            onSelect={() => mutate.mutate({ ids: [r.id], action: "publish" })}
                          >
                            <Send className="me-2 h-3.5 w-3.5" /> Publish
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        {r.lifecycle !== "archived" ? (
                          <DropdownMenuItem
                            onSelect={() => mutate.mutate({ ids: [r.id], action: "archive" })}
                            className="text-red-700 focus:text-red-800"
                          >
                            <Archive className="me-2 h-3.5 w-3.5" /> Archive
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() => mutate.mutate({ ids: [r.id], action: "restore" })}
                          >
                            <ArchiveRestore className="me-2 h-3.5 w-3.5" /> Restore
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                          <Link to={`/admin/trust/admin-activity?target=${r.id}`}>
                            <ClipboardCheck className="me-2 h-3.5 w-3.5" /> Activity
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-muted-foreground">
          {isLoading ? "Loading…" : `${total.toLocaleString()} resources · page ${page} of ${totalPages}`}
          {isFetching && !isLoading ? <Loader2 className="ms-2 inline h-3 w-3 animate-spin" /> : null}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="min-h-[36px]"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-[36px]"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <AlertDialog open={!!confirmBulk} onOpenChange={(v) => (v ? null : setConfirmBulk(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm bulk {confirmBulk} on {selected.size} resource(s)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmBulk === "archive"
                ? "Archived resources are hidden from the public catalog. Downloads are blocked. Recoverable from Archived filter."
                : confirmBulk === "publish"
                ? "Published resources become visible to all users immediately."
                : "Submits selected resources to the review queue."}
              {" Partial success is possible — per-row results are reported."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmBulk && applyBulk(confirmBulk)}
              disabled={mutate.isPending}
            >
              {mutate.isPending ? <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

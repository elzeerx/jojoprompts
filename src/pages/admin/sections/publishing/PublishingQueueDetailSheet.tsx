import { useQuery } from "@tanstack/react-query";
import { Loader2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatFils } from "@/lib/v2/admin/format";
import {
  deriveReadiness, describeReadiness, type QueueRowInput,
} from "@/lib/v2/admin/publishingReadiness";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: (QueueRowInput & {
    slug: string;
    title_ar: string | null;
    updated_at: string;
    current_version_label: string | null;
    price_fils: number | null;
  }) | null;
}

// ---------- Typed adapters over admin RPCs + directly-readable tables ---------
// Isolated, narrow adapters. The generated Supabase types for the JSONB-returning
// admin RPCs come back as `Json`, so we shape them here once and keep the rest of
// the file strongly typed. Keep casts scoped to this section.

interface ResourceRow {
  id: string;
  slug: string;
  type: string;
  lifecycle: string;
  title_en: string | null;
  title_ar: string | null;
  summary_en: string | null;
  summary_ar: string | null;
  description_en: string | null;
  description_ar: string | null;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
}

interface PlatformRow {
  id: string;
  platform_slug: string;
  min_version: string | null;
  is_verified: boolean | null;
  notes_en: string | null;
  notes_ar: string | null;
}

interface PermissionRow {
  id: string;
  kind: string | null;
  key: string | null;
  label_en: string | null;
  label_ar: string | null;
  is_required: boolean | null;
  is_public: boolean | null;
}

interface GuideRow {
  id: string;
  platform_slug: string | null;
  estimated_minutes: number | null;
  steps_en: unknown;
  steps_ar: unknown;
}

interface ProductRow {
  id: string;
  product_type: string;
  is_active: boolean;
  price_fils: number | null;
  title_en: string | null;
  title_ar: string | null;
  currency: string | null;
}

interface ActivityRow {
  id: string;
  created_at: string;
  action: string;
  actor_type: string;
  metadata: unknown;
}

interface VersionInfo {
  version_id: string;
  version: string;
  major_version: number;
  is_current: boolean;
  published_at: string | null;
  package_size_bytes: number | null;
  package_checksum: string | null;
  changelog_en: string | null;
  changelog_ar: string | null;
}

interface VersionFile {
  id: string;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  checksum_sha256: string | null;
  created_at: string | null;
}

interface VersionScanSummary {
  id: string;
  scanner: string | null;
  status: string | null;
  findings: unknown;
  scanned_at: string | null;
  created_at: string | null;
}

interface ScanItemDetail {
  id: string;
  status: string | null;
  result_code: number | null;
  progress: number | null;
  total_engines: number | null;
  detected_engines: number | null;
  findings: unknown;
  attempt_count: number | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  file: { file_name: string | null; content_type: string | null; size_bytes: number | null } | null;
}

interface ScanDetail {
  scan: {
    id: string;
    scanner: string | null;
    status: string | null;
    findings: unknown;
    scanned_at: string | null;
    created_at: string | null;
    requested_at: string | null;
    completed_at: string | null;
    attempt_count: number | null;
    last_error_code: string | null;
  };
  items: ScanItemDetail[];
}

interface SectionError { message: string }

interface DetailPayload {
  resource: ResourceRow | null;
  resourceError: SectionError | null;
  platforms: PlatformRow[];
  platformsError: SectionError | null;
  permissions: PermissionRow[];
  permissionsError: SectionError | null;
  guides: GuideRow[];
  guidesError: SectionError | null;
  products: ProductRow[];
  productsError: SectionError | null;
  activity: ActivityRow[];
  activityError: SectionError | null;
  version: VersionInfo | null;
  files: VersionFile[];
  scans: VersionScanSummary[];
  versionError: SectionError | null;
  latestScan: ScanDetail | null;
  latestScanError: SectionError | null;
}

function toErr(e: unknown): SectionError {
  const message = e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to load";
  return { message };
}

async function fetchDetail(resourceId: string, versionId: string | null): Promise<DetailPayload> {
  // Kick off all independent reads in parallel and settle each individually so a
  // failed secondary query surfaces as an "unavailable" section instead of
  // silently blanking out.
  const [resSet, platSet, permSet, guideSet, prodSet, actSet, verSet] = await Promise.allSettled([
    supabase.from("resources").select(
      "id, slug, type, lifecycle, title_en, title_ar, summary_en, summary_ar, description_en, description_ar, updated_at, published_at, archived_at",
    ).eq("id", resourceId).maybeSingle(),
    supabase.from("platform_compatibility").select(
      "id, platform_slug, min_version, is_verified, notes_en, notes_ar",
    ).eq("resource_id", resourceId),
    supabase.from("resource_permissions").select(
      "id, kind, key, label_en, label_ar, is_required, is_public",
    ).eq("resource_id", resourceId),
    supabase.from("installation_guides").select(
      "id, platform_slug, estimated_minutes, steps_en, steps_ar",
    ).eq("resource_id", resourceId),
    supabase.from("products").select(
      "id, product_type, is_active, price_fils, title_en, title_ar, currency",
    ).eq("resource_id", resourceId),
    supabase.from("activity_events").select(
      "id, created_at, action, actor_type, metadata",
    ).eq("entity_type", "resource").eq("entity_id", resourceId)
      .order("created_at", { ascending: false }).limit(20),
    versionId
      ? supabase.rpc("v2_admin_get_resource_version_detail", { p_version_id: versionId })
      : Promise.resolve({ data: null, error: null }),
  ]);

  const unwrap = <T,>(s: PromiseSettledResult<{ data: unknown; error: unknown } | { data: unknown; error: null }>): { data: T | null; err: SectionError | null } => {
    if (s.status === "rejected") return { data: null, err: toErr(s.reason) };
    const { data, error } = s.value as { data: unknown; error: unknown };
    if (error) return { data: null, err: toErr(error) };
    return { data: (data as T) ?? null, err: null };
  };
  const unwrapList = <T,>(s: PromiseSettledResult<{ data: unknown; error: unknown }>): { data: T[]; err: SectionError | null } => {
    const r = unwrap<T[]>(s as PromiseSettledResult<{ data: unknown; error: unknown }>);
    return { data: r.data ?? [], err: r.err };
  };

  const resource = unwrap<ResourceRow>(resSet);
  const platforms = unwrapList<PlatformRow>(platSet);
  const permissions = unwrapList<PermissionRow>(permSet);
  const guides = unwrapList<GuideRow>(guideSet);
  const products = unwrapList<ProductRow>(prodSet);
  const activity = unwrapList<ActivityRow>(actSet);

  let version: VersionInfo | null = null;
  let files: VersionFile[] = [];
  let scans: VersionScanSummary[] = [];
  let versionError: SectionError | null = null;
  let latestScan: ScanDetail | null = null;
  let latestScanError: SectionError | null = null;

  if (versionId) {
    if (verSet.status === "rejected") {
      versionError = toErr(verSet.reason);
    } else {
      const { data, error } = verSet.value as { data: unknown; error: unknown };
      if (error) versionError = toErr(error);
      else if (data && typeof data === "object") {
        const payload = data as { version?: VersionInfo; files?: VersionFile[]; scans?: VersionScanSummary[] };
        version = payload.version ?? null;
        files = Array.isArray(payload.files) ? payload.files : [];
        scans = Array.isArray(payload.scans) ? payload.scans : [];
      }
    }
    const latestScanId = scans[0]?.id ?? null;
    if (latestScanId) {
      try {
        const { data, error } = await supabase.rpc("v2_admin_get_package_scan_details", { p_scan_id: latestScanId });
        if (error) latestScanError = toErr(error);
        else if (data && typeof data === "object") latestScan = data as unknown as ScanDetail;
      } catch (e) {
        latestScanError = toErr(e);
      }
    }
  }

  return {
    resource: resource.data,
    resourceError: resource.err,
    platforms: platforms.data,
    platformsError: platforms.err,
    permissions: permissions.data,
    permissionsError: permissions.err,
    guides: guides.data,
    guidesError: guides.err,
    products: products.data,
    productsError: products.err,
    activity: activity.data,
    activityError: activity.err,
    version,
    files,
    scans,
    versionError,
    latestScan,
    latestScanError,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="text-sm text-dark-base">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(120px,max-content)_1fr] gap-2 text-xs">
      <div className="text-muted-foreground">{k}</div>
      <div className="break-words">{v ?? <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function Unavailable({ err }: { err: SectionError }) {
  return (
    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 break-words">
      Section unavailable: {err.message}
    </div>
  );
}

function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Render steps_en/steps_ar as a numbered list when the JSON is a shaped array;
 *  otherwise fall back to a readable <pre> so we never blank out data. */
function StepsList({ steps, dir }: { steps: unknown; dir?: "rtl" | "ltr" }) {
  if (steps == null) return <span className="text-muted-foreground text-xs">—</span>;
  if (Array.isArray(steps)) {
    const items = steps.map((s, i): { title: string; body: string | null } => {
      if (typeof s === "string") return { title: s, body: null };
      if (s && typeof s === "object") {
        const obj = s as Record<string, unknown>;
        const title = typeof obj.title === "string" ? obj.title
          : typeof obj.heading === "string" ? obj.heading
          : `Step ${i + 1}`;
        const body = typeof obj.body === "string" ? obj.body
          : typeof obj.text === "string" ? obj.text
          : typeof obj.description === "string" ? obj.description
          : null;
        return { title, body };
      }
      return { title: `Step ${i + 1}`, body: JSON.stringify(s) };
    });
    return (
      <ol dir={dir} className="list-decimal space-y-1 ps-5 text-xs">
        {items.map((it, i) => (
          <li key={i} className="break-words">
            <div className="font-medium">{it.title}</div>
            {it.body ? <div className="text-muted-foreground whitespace-pre-wrap">{it.body}</div> : null}
          </li>
        ))}
      </ol>
    );
  }
  // Structured but not an array — render as compact JSON so operators can still read it.
  return (
    <pre dir={dir} className="whitespace-pre-wrap break-words rounded bg-muted/50 p-2 text-[11px] font-mono">
      {JSON.stringify(steps, null, 2)}
    </pre>
  );
}

export function PublishingQueueDetailSheet({ open, onOpenChange, row }: Props) {
  const q = useQuery<DetailPayload>({
    queryKey: ["admin", "v2", "publishing-detail", row?.id, row?.current_version_id],
    queryFn: () => fetchDetail(row!.id, row!.current_version_id),
    enabled: open && !!row,
    staleTime: 10_000,
  });

  if (!row) return null;
  const rd = deriveReadiness(row);
  const data = q.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <SheetHeader className="p-4 sm:p-6 border-b">
          <SheetTitle className="break-words">{row.title_en || row.slug}</SheetTitle>
          <SheetDescription className="break-words">
            {row.slug} · <span className="capitalize">{row.type.replace("_", " ")}</span>
            {row.current_version_label ? ` · ${row.current_version_label}` : ""}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-96px)]">
          <div className="p-4 sm:p-6 space-y-6">
            {q.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading details…
              </div>
            ) : q.isError ? (
              <div className="text-sm text-red-600">
                Failed to load: {q.error instanceof Error ? q.error.message : "unknown"}
              </div>
            ) : !data ? (
              <div className="text-sm text-muted-foreground">No data.</div>
            ) : (
              <>
                <Section title="Readiness">
                  {rd.blockers.length === 0 ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Ready for {row.lifecycle === "draft" ? "review" : "publish"}
                    </Badge>
                  ) : (
                    <ul className="list-disc space-y-1 ps-5 text-xs">
                      {rd.blockers.map((b) => (
                        <li key={b}>{describeReadiness(b)}</li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Separator />

                {data.resourceError ? (
                  <Section title="Metadata"><Unavailable err={data.resourceError} /></Section>
                ) : !data.resource ? (
                  <Section title="Metadata">
                    <span className="text-muted-foreground text-xs">Resource not found or you don't have access.</span>
                  </Section>
                ) : (
                  <>
                    <Section title="Metadata (English)">
                      <KV k="Title" v={data.resource.title_en} />
                      <KV k="Summary" v={data.resource.summary_en} />
                      <KV k="Description" v={<span className="whitespace-pre-wrap">{data.resource.description_en}</span>} />
                    </Section>

                    <Section title="Metadata (Arabic)">
                      <div dir="rtl">
                        <KV k="العنوان" v={data.resource.title_ar} />
                        <KV k="الملخص" v={data.resource.summary_ar} />
                        <KV k="الوصف" v={<span className="whitespace-pre-wrap">{data.resource.description_ar}</span>} />
                      </div>
                    </Section>

                    <Separator />

                    <Section title="Lifecycle">
                      <KV k="Status" v={<Badge variant="outline" className="capitalize">{data.resource.lifecycle}</Badge>} />
                      <KV k="Slug" v={data.resource.slug} />
                      <KV k="Type" v={<span className="capitalize">{data.resource.type.replace("_", " ")}</span>} />
                      <KV k="Current version" v={
                        data.version
                          ? `v${data.version.major_version}.${data.version.version}${data.version.is_current ? " (current)" : ""}`
                          : "None"
                      } />
                      <KV k="Updated" v={formatDateTime(data.resource.updated_at)} />
                      <KV k="Published" v={data.resource.published_at ? formatDateTime(data.resource.published_at) : "—"} />
                      <KV k="Archived" v={data.resource.archived_at ? formatDateTime(data.resource.archived_at) : "—"} />
                    </Section>
                  </>
                )}

                <Separator />

                <Section title={`Platform compatibility${data.platformsError ? "" : ` (${data.platforms.length})`}`}>
                  {data.platformsError ? (
                    <Unavailable err={data.platformsError} />
                  ) : data.platforms.length === 0 ? (
                    <span className="text-muted-foreground text-xs">None declared.</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {data.platforms.map((p) => (
                        <Badge key={p.id} variant="outline" className="text-[10px]">
                          {p.platform_slug}{p.min_version ? ` ≥ ${p.min_version}` : ""}{p.is_verified ? " ✓" : ""}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title={`Permissions & dependencies${data.permissionsError ? "" : ` (${data.permissions.length})`}`}>
                  {data.permissionsError ? (
                    <Unavailable err={data.permissionsError} />
                  ) : data.permissions.length === 0 ? (
                    <span className="text-muted-foreground text-xs">None declared.</span>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {data.permissions.map((p) => (
                        <li key={p.id} className="rounded border p-2 space-y-1 break-words">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="capitalize">{p.kind ?? "permission"}</Badge>
                            {p.key ? <code className="text-[10px] font-mono break-all">{p.key}</code> : null}
                            <Badge variant="outline" className={p.is_required ? "bg-red-50 text-red-700 border-red-200" : ""}>
                              {p.is_required ? "Required" : "Optional"}
                            </Badge>
                            <Badge variant="outline" className={p.is_public ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}>
                              {p.is_public ? "Public" : "Internal"}
                            </Badge>
                          </div>
                          {p.label_en ? <div>{p.label_en}</div> : null}
                          {p.label_ar ? <div dir="rtl" className="text-muted-foreground">{p.label_ar}</div> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section title={`Installation guides${data.guidesError ? "" : ` (${data.guides.length})`}`}>
                  {data.guidesError ? (
                    <Unavailable err={data.guidesError} />
                  ) : data.guides.length === 0 ? (
                    <span className="text-muted-foreground text-xs">No guides.</span>
                  ) : (
                    <ul className="space-y-3 text-xs">
                      {data.guides.map((g) => (
                        <li key={g.id} className="rounded border p-3 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{g.platform_slug ?? "any platform"}</Badge>
                            {g.estimated_minutes != null ? (
                              <span className="text-muted-foreground">~{g.estimated_minutes} min</span>
                            ) : null}
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Steps (EN)</div>
                            <StepsList steps={g.steps_en} />
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">الخطوات (AR)</div>
                            <StepsList steps={g.steps_ar} dir="rtl" />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Separator />

                <Section title={`Package files${data.versionError ? "" : ` (${data.files.length})`}`}>
                  {!row.current_version_id ? (
                    <span className="text-muted-foreground text-xs">No current version.</span>
                  ) : data.versionError ? (
                    <Unavailable err={data.versionError} />
                  ) : data.files.length === 0 ? (
                    <span className="text-muted-foreground text-xs">No files uploaded.</span>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {data.files.map((f) => (
                        <li key={f.id} className="break-words rounded border p-2">
                          <div className="font-medium break-all">{f.file_name ?? "file"}</div>
                          <div className="text-muted-foreground">
                            {f.content_type ?? "—"} · {formatBytes(f.size_bytes)}
                          </div>
                          {f.checksum_sha256 ? (
                            <div className="mt-1 text-[10px] font-mono break-all text-muted-foreground">
                              sha256: {f.checksum_sha256}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section title="Latest scan">
                  {!row.current_version_id ? (
                    <span className="text-muted-foreground text-xs">No current version.</span>
                  ) : data.versionError ? (
                    <Unavailable err={data.versionError} />
                  ) : data.scans.length === 0 ? (
                    <span className="text-muted-foreground text-xs">Never scanned.</span>
                  ) : (
                    (() => {
                      const summary = data.scans[0];
                      const detail = data.latestScan;
                      return (
                        <div className="space-y-3">
                          <div>
                            <KV k="Status" v={<Badge variant="outline" className="capitalize">{summary.status ?? "—"}</Badge>} />
                            <KV k="Scanner" v={summary.scanner ?? "—"} />
                            <KV k="Requested" v={detail?.scan.requested_at ? formatDateTime(detail.scan.requested_at) : (summary.created_at ? formatDateTime(summary.created_at) : "—")} />
                            <KV k="Completed" v={detail?.scan.completed_at ? formatDateTime(detail.scan.completed_at) : "—"} />
                            <KV k="Scanned" v={summary.scanned_at ? formatDateTime(summary.scanned_at) : "—"} />
                            {detail?.scan.attempt_count != null ? (
                              <KV k="Attempts" v={String(detail.scan.attempt_count)} />
                            ) : null}
                            {detail?.scan.last_error_code ? (
                              <KV k="Last error" v={<code className="text-[10px] font-mono break-all">{detail.scan.last_error_code}</code>} />
                            ) : null}
                          </div>

                          {data.latestScanError ? (
                            <Unavailable err={data.latestScanError} />
                          ) : detail && detail.items.length > 0 ? (
                            <div className="space-y-1 text-[11px]">
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Items ({detail.items.length})</div>
                              {detail.items.map((it) => (
                                <div key={it.id} className="rounded border p-2 break-words space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium break-all">{it.file?.file_name ?? it.id}</span>
                                    <Badge variant="outline" className="capitalize">{it.status ?? "—"}</Badge>
                                    {it.result_code != null ? (
                                      <span className="text-muted-foreground">code {it.result_code}</span>
                                    ) : null}
                                    {it.progress != null ? (
                                      <span className="text-muted-foreground">{it.progress}%</span>
                                    ) : null}
                                  </div>
                                  <div className="text-muted-foreground">
                                    {it.file?.content_type ?? "—"} · {formatBytes(it.file?.size_bytes ?? null)}
                                  </div>
                                  {(it.detected_engines != null || it.total_engines != null) ? (
                                    <div className="text-muted-foreground">
                                      Engines: {it.detected_engines ?? 0}/{it.total_engines ?? 0}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()
                  )}
                </Section>

                <Separator />

                <Section title={`Products${data.productsError ? "" : ` (${data.products.length})`}`}>
                  {data.productsError ? (
                    <Unavailable err={data.productsError} />
                  ) : data.products.length === 0 ? (
                    <span className="text-muted-foreground text-xs">No products configured.</span>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {data.products.map((p) => (
                        <li key={p.id} className="rounded border p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="capitalize">{p.product_type}</Badge>
                            {p.is_active ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                            ) : (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                            <span className="tabular-nums">{formatFils(p.price_fils ?? 0)}</span>
                            {p.currency ? <span className="text-muted-foreground">{p.currency}</span> : null}
                          </div>
                          {p.title_en ? <div className="mt-1">{p.title_en}</div> : null}
                          {p.title_ar ? <div dir="rtl" className="text-muted-foreground">{p.title_ar}</div> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Separator />

                <Section title={`Recent activity${data.activityError ? "" : ` (${data.activity.length})`}`}>
                  {data.activityError ? (
                    <Unavailable err={data.activityError} />
                  ) : data.activity.length === 0 ? (
                    <span className="text-muted-foreground text-xs">No activity recorded.</span>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {data.activity.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-2 border-b py-1 last:border-b-0">
                          <span className="break-words">
                            <span className="font-medium">{a.action}</span>{" "}
                            <span className="text-muted-foreground">by {a.actor_type}</span>
                          </span>
                          <span className="text-muted-foreground whitespace-nowrap">{formatDateTime(a.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <div className="pt-2">
                  <Link
                    to={`/admin/publishing/resources/${row.id}/edit`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-input px-3 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ExternalLink className="h-4 w-4" /> Open in editor
                  </Link>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default PublishingQueueDetailSheet;

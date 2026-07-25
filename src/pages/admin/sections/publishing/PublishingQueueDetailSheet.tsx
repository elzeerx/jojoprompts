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

/**
 * Isolated typed data-access boundary. The generated Supabase types (see
 * src/integrations/supabase/types.ts) lag the deployed V2 schema in a few
 * spots (e.g. resource_versions.version_label). We cast once here so
 * downstream code stays typed. Do not spread this cast outside this file.
 */
type SupabaseAny = { from: (t: string) => any; rpc: (n: string, args?: any) => any };
const db = supabase as unknown as SupabaseAny;

async function fetchDetail(resourceId: string, versionId: string | null) {
  const [resRes, verRes, platRes, permRes, guideRes, filesRes, scanRes, itemsRes, prodRes, actRes] =
    await Promise.all([
      db.from("resources").select("*").eq("id", resourceId).maybeSingle(),
      versionId
        ? db.from("resource_versions").select("*").eq("id", versionId).maybeSingle()
        : Promise.resolve({ data: null }),
      db.from("platform_compatibility").select("*").eq("resource_id", resourceId),
      db.from("resource_permissions").select("*").eq("resource_id", resourceId),
      db.from("installation_guides").select("*").eq("resource_id", resourceId),
      versionId
        ? db.from("resource_files").select("*").eq("resource_version_id", versionId)
        : Promise.resolve({ data: [] }),
      versionId
        ? db.from("package_scans").select("*").eq("resource_version_id", versionId)
            .order("created_at", { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      versionId
        ? db.from("package_scan_items").select("*").eq("resource_version_id", versionId)
        : Promise.resolve({ data: [] }),
      db.from("products").select("*").eq("resource_id", resourceId),
      db.from("activity_events").select("id,created_at,action,actor_type,metadata")
        .eq("entity_type", "resource").eq("entity_id", resourceId)
        .order("created_at", { ascending: false }).limit(20),
    ]);
  return {
    resource: resRes.data ?? null,
    version: verRes.data ?? null,
    platforms: platRes.data ?? [],
    permissions: permRes.data ?? [],
    guides: guideRes.data ?? [],
    files: filesRes.data ?? [],
    scan: scanRes.data ?? null,
    scanItems: itemsRes.data ?? [],
    products: prodRes.data ?? [],
    activity: actRes.data ?? [],
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

export function PublishingQueueDetailSheet({ open, onOpenChange, row }: Props) {
  const q = useQuery({
    queryKey: ["admin", "v2", "publishing-detail", row?.id, row?.current_version_id],
    queryFn: () => fetchDetail(row!.id, row!.current_version_id),
    enabled: open && !!row,
    staleTime: 10_000,
  });

  if (!row) return null;
  const rd = deriveReadiness(row);

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
              <div className="text-sm text-red-600">Failed to load: {(q.error as any)?.message ?? "unknown"}</div>
            ) : !q.data?.resource ? (
              <div className="text-sm text-muted-foreground">Resource not found or you don't have access.</div>
            ) : (
              <>
                <Section title="Readiness">
                  {rd.blockers.length === 0 ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      Ready for {row.lifecycle === "draft" ? "review" : "publish"}
                    </Badge>
                  ) : (
                    <ul className="list-disc space-y-1 pl-5 text-xs">
                      {rd.blockers.map((b) => (
                        <li key={b}>{describeReadiness(b)}</li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Separator />

                <Section title="Metadata (English)">
                  <KV k="Title" v={q.data.resource.title_en} />
                  <KV k="Summary" v={q.data.resource.summary_en} />
                  <KV k="Description" v={<span className="whitespace-pre-wrap">{q.data.resource.description_en}</span>} />
                </Section>

                <Section title="Metadata (Arabic)">
                  <div dir="rtl">
                    <KV k="العنوان" v={q.data.resource.title_ar} />
                    <KV k="الملخص" v={q.data.resource.summary_ar} />
                    <KV k="الوصف" v={<span className="whitespace-pre-wrap">{q.data.resource.description_ar}</span>} />
                  </div>
                </Section>

                <Separator />

                <Section title="Lifecycle">
                  <KV k="Status" v={<Badge variant="outline" className="capitalize">{q.data.resource.lifecycle}</Badge>} />
                  <KV k="Slug" v={q.data.resource.slug} />
                  <KV k="Type" v={<span className="capitalize">{String(q.data.resource.type).replace("_", " ")}</span>} />
                  <KV k="Current version" v={
                    q.data.version
                      ? `v${q.data.version.major_version}.${q.data.version.version}${q.data.version.version_label ? ` — ${q.data.version.version_label}` : ""}`
                      : "None"
                  } />
                  <KV k="Updated" v={formatDateTime(q.data.resource.updated_at)} />
                  <KV k="Published" v={q.data.resource.published_at ? formatDateTime(q.data.resource.published_at) : "—"} />
                  <KV k="Archived" v={q.data.resource.archived_at ? formatDateTime(q.data.resource.archived_at) : "—"} />
                </Section>

                <Separator />

                <Section title={`Platform compatibility (${q.data.platforms.length})`}>
                  {q.data.platforms.length === 0 ? (
                    <span className="text-muted-foreground text-xs">None declared.</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {q.data.platforms.map((p: any) => (
                        <Badge key={p.id ?? p.platform_slug} variant="outline" className="text-[10px]">
                          {p.platform_slug}{p.min_version ? ` ≥ ${p.min_version}` : ""}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Section>

                <Section title={`Permissions & dependencies (${q.data.permissions.length})`}>
                  {q.data.permissions.length === 0 ? (
                    <span className="text-muted-foreground text-xs">None declared.</span>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {q.data.permissions.map((p: any) => (
                        <li key={p.id} className="break-words">
                          <span className="font-medium">{p.kind ?? p.permission_type ?? "permission"}:</span>{" "}
                          {p.value ?? p.name ?? JSON.stringify(p)}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section title={`Installation guides (${q.data.guides.length})`}>
                  {q.data.guides.length === 0 ? (
                    <span className="text-muted-foreground text-xs">No guides.</span>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {q.data.guides.map((g: any) => (
                        <li key={g.id} className="break-words">
                          <div className="font-medium">{g.platform_slug ?? g.title ?? "Guide"}</div>
                          {g.instructions ? <div className="whitespace-pre-wrap text-muted-foreground">{g.instructions}</div> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Separator />

                <Section title={`Package files (${q.data.files.length})`}>
                  {q.data.files.length === 0 ? (
                    <span className="text-muted-foreground text-xs">No files uploaded.</span>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {q.data.files.map((f: any) => (
                        <li key={f.id} className="break-words rounded border p-2">
                          <div className="font-medium">{f.file_name ?? f.original_name ?? "file"}</div>
                          <div className="text-muted-foreground">
                            {f.mime_type ?? "—"} · {f.size_bytes != null ? `${f.size_bytes} bytes` : "—"}
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
                  {!q.data.scan ? (
                    <span className="text-muted-foreground text-xs">Never scanned.</span>
                  ) : (
                    <>
                      <KV k="Status" v={<Badge variant="outline" className="capitalize">{q.data.scan.status}</Badge>} />
                      <KV k="Provider" v={q.data.scan.provider ?? "—"} />
                      <KV k="Started" v={q.data.scan.created_at ? formatDateTime(q.data.scan.created_at) : "—"} />
                      <KV k="Completed" v={q.data.scan.scanned_at ? formatDateTime(q.data.scan.scanned_at) : "—"} />
                      {q.data.scanItems.length > 0 ? (
                        <div className="mt-2 space-y-1 text-[11px]">
                          {q.data.scanItems.map((it: any) => (
                            <div key={it.id} className="flex flex-wrap gap-1 rounded border p-2">
                              <span className="font-medium">{it.file_name ?? it.resource_file_id}</span>
                              <Badge variant="outline" className="capitalize">{it.status}</Badge>
                              {it.result_code != null ? <span className="text-muted-foreground">code {it.result_code}</span> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </Section>

                <Separator />

                <Section title={`Products (${q.data.products.length})`}>
                  {q.data.products.length === 0 ? (
                    <span className="text-muted-foreground text-xs">No products configured.</span>
                  ) : (
                    <ul className="space-y-2 text-xs">
                      {q.data.products.map((p: any) => (
                        <li key={p.id} className="rounded border p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="capitalize">{p.product_type}</Badge>
                            {p.is_active ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
                            ) : (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                            <span className="tabular-nums">{formatFils(p.price_fils ?? 0)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Separator />

                <Section title={`Recent activity (${q.data.activity.length})`}>
                  {q.data.activity.length === 0 ? (
                    <span className="text-muted-foreground text-xs">No activity recorded.</span>
                  ) : (
                    <ul className="space-y-1 text-xs">
                      {q.data.activity.map((a: any) => (
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

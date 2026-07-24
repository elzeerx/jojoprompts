import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/v2/admin/format";
import { useAdminResourceVersionDetail } from "@/hooks/admin/v2/useAdminResourceVersions";
import { UploadPackageFile } from "./UploadPackageFile";


interface Props {
  versionId: string | null;
  onOpenChange: (open: boolean) => void;
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function scanTone(
  s: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (s === "clean") return "secondary";
  if (s === "pending") return "default";
  if (s === "suspicious" || s === "malicious" || s === "failed")
    return "destructive";
  return "outline";
}

export default function VersionDetailSheet({ versionId, onOpenChange }: Props) {
  const query = useAdminResourceVersionDetail(versionId);
  const detail = query.data ?? null;
  const v = detail?.version ?? null;

  return (
    <Sheet open={!!versionId} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
        dir="ltr"
        closeLabel="Close"
      >

        <SheetHeader>
          <SheetTitle>Resource version</SheetTitle>
        </SheetHeader>

        {query.isLoading ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            Error: {(query.error as Error).message}
          </div>
        ) : v ? (
          <div className="mt-4 space-y-6 text-sm">
            <section className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {v.resource_type.replace("_", " ")}
                </Badge>
                {v.is_current && <Badge variant="default">current</Badge>}
                <Badge variant="outline" className="capitalize">
                  {v.lifecycle}
                </Badge>
              </div>
              <div className="text-lg font-semibold">
                {v.title_en || v.slug}
              </div>
              {v.title_ar && (
                <div className="text-sm text-muted-foreground" dir="rtl">
                  {v.title_ar}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                <Link
                  to={`/admin/catalog?q=${encodeURIComponent(v.slug)}`}
                  className="underline underline-offset-2"
                >
                  {v.slug}
                </Link>{" "}
                · v{v.version} · major {v.major_version}
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <Meta label="Published" value={formatDateTime(v.published_at)} />
              <Meta label="Created" value={formatDateTime(v.created_at)} />
              <Meta label="Updated" value={formatDateTime(v.updated_at)} />
              <Meta
                label="Package size"
                value={formatBytes(v.package_size_bytes)}
              />
              <Meta
                label="Checksum"
                value={v.package_checksum ? "present" : "—"}
              />
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Changelog</h3>
              <div className="rounded-md border p-3 whitespace-pre-wrap text-xs">
                {v.changelog_en || (
                  <span className="text-muted-foreground">
                    No English changelog
                  </span>
                )}
              </div>
              <div
                className="rounded-md border p-3 whitespace-pre-wrap text-xs"
                dir="rtl"
              >
                {v.changelog_ar || (
                  <span className="text-muted-foreground">
                    لا يوجد سجل تغييرات بالعربية
                  </span>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-semibold">
                  Package files ({detail?.files.length ?? 0})
                </h3>
              </div>
              {versionId && <UploadPackageFile versionId={versionId} />}
              {(detail?.files.length ?? 0) === 0 ? (
                <div className="rounded-md border p-4 text-xs text-muted-foreground">
                  No package files uploaded
                </div>

              ) : (
                <div className="rounded-md border divide-y">
                  {detail!.files.map((f) => (
                    <div key={f.id} className="p-3 text-xs space-y-1">
                      <div className="font-medium truncate">{f.file_name}</div>
                      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                        <span>{f.content_type ?? "—"}</span>
                        <span>{formatBytes(f.size_bytes)}</span>
                        <span>{formatDateTime(f.created_at)}</span>
                      </div>
                      {f.checksum_sha256 && (
                        <div className="font-mono text-[10px] text-muted-foreground break-all">
                          sha256: {f.checksum_sha256}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                Recent scans ({detail?.scans.length ?? 0})
              </h3>
              {(detail?.scans.length ?? 0) === 0 ? (
                <div className="rounded-md border p-4 text-xs text-muted-foreground">
                  No scan history
                </div>
              ) : (
                <div className="space-y-2">
                  {detail!.scans.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-md border p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant={scanTone(s.status)}>{s.status}</Badge>
                        <span className="text-muted-foreground">
                          {s.scanner}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        {formatDateTime(s.scanned_at ?? s.created_at)}
                      </div>
                      <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-muted p-2 font-mono text-[10px]">
                        {JSON.stringify(s.findings ?? {}, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="mt-6 text-sm text-muted-foreground">
            Version not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

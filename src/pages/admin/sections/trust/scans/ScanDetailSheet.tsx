import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/v2/admin/format";
import { useAdminResourceVersionDetail } from "@/hooks/admin/v2/useAdminResourceVersions";
import type { PackageScanState } from "@/hooks/admin/v2/useAdminPackageScans";
import {
  useAdminPackageScanDetails,
  useQueueScan,
  useRefreshScan,
  useScanProviderStatus,
} from "@/hooks/admin/v2/useScanProvider";
import {
  formatBytes,
  formatFindings,
  statusLabel,
  statusTone,
} from "./scanHelpers";
import { evaluateQueueGuard } from "./queueGuard";
import { useVersionPendingChildProbe } from "./useVersionPendingChildProbe";

interface Props {
  versionId: string | null;
  onOpenChange: (open: boolean) => void;
}

export default function ScanDetailSheet({ versionId, onOpenChange }: Props) {
  const query = useAdminResourceVersionDetail(versionId);
  const detail = query.data ?? null;
  const v = detail?.version ?? null;

  const providerStatus = useScanProviderStatus();
  const ready = providerStatus.data?.readiness.ready ?? false;

  const queueMutation = useQueueScan();
  const refreshMutation = useRefreshScan();

  // Server admission is authoritative. The frontend mirrors the guard using
  // the SAME coverage-aware effective state the download authorization path
  // uses (v2_internal_effective_scan_state via detail.effective_scan). Raw
  // scans[0] is displayed only; it MUST NOT drive Queue admission.
  const scans = detail?.scans ?? [];
  const hasPendingAggregate = scans.some((s) => s.status === "pending");
  const eff = detail?.effective_scan ?? null;
  const effectiveStateKnown = eff != null;
  const hasFiles = effectiveStateKnown
    ? eff!.has_files
    : (detail?.files.length ?? 0) > 0;
  // Only trust status derived from the coverage-aware helper. When the
  // effective state is not known we pass null (real unscanned semantics only
  // apply when effectiveStateKnown=true; the guard fails closed via
  // effectiveStateKnown=false before this value is interpreted).
  const effectiveStatus = (eff?.effective_status ?? null) as PackageScanState | null;
  const coverageValid = eff ? eff.coverage_valid : undefined;

  const probe = useVersionPendingChildProbe(scans);
  const guard = evaluateQueueGuard({
    providerReady: ready,
    hasFiles,
    effectiveStateKnown,
    latestScanStatus: effectiveStatus,
    coverageValid,
    hasPendingAggregate,
    hasPendingChild: probe.hasPendingChild,
    pendingChildProbeLoading: probe.isUnresolved,
  });
  const canQueue = guard.canQueue;




  const handleQueue = async () => {
    if (!versionId) return;
    try {
      await queueMutation.mutateAsync(versionId);
      toast({ title: "Scan queued", description: "Worker will start uploading shortly." });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not queue scan",
        description: (e as Error).message,
      });
    }
  };

  const handleRefresh = async (scanId: string) => {
    try {
      await refreshMutation.mutateAsync(scanId);
      toast({ title: "Refresh requested" });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Refresh failed",
        description: (e as Error).message,
      });
    }
  };

  return (
    <Sheet open={!!versionId} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto"
        dir="ltr"
        closeLabel="Close"
      >
        <SheetHeader>
          <SheetTitle>Package scan history</SheetTitle>
        </SheetHeader>

        {query.isLoading ? (
          <div className="mt-4 space-y-3">
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
                  to={`/admin/publishing/versions?q=${encodeURIComponent(v.slug)}`}
                  className="underline underline-offset-2"
                >
                  {v.slug}
                </Link>{" "}
                · v{v.version} · major {v.major_version}
              </div>
            </section>

            <section className="rounded-md border p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-muted-foreground">
                  {ready
                    ? "Cloudmersive Virus Scan is configured. Queueing runs an advanced scan on every package file with strict content policies."
                    : "Scan actions are disabled until Cloudmersive is configured. Add CLOUDMERSIVE_API_KEY and PACKAGE_SCAN_WORKER_SECRET in Supabase → Edge Functions → Secrets."}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="min-h-[44px] w-full sm:w-auto"
                      disabled={!canQueue || queueMutation.isPending}
                      aria-disabled={!canQueue || queueMutation.isPending}
                    >
                      {queueMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 mr-2" />
                      )}
                      Queue scan
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Queue package scan?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The worker will upload every file in this version to
                        Cloudmersive Virus Scan (advanced) with strict content
                        policies. Only sanitized findings are stored — file
                        bytes, storage paths, and API keys are never persisted
                        or logged.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="min-h-[44px]">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="min-h-[44px]"
                        onClick={handleQueue}
                      >
                        Queue scan
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <Meta label="Published" value={formatDateTime(v.published_at)} />
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
              <h3 className="text-sm font-semibold">
                Package files ({detail?.files.length ?? 0})
              </h3>
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
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                Scan history ({detail?.scans.length ?? 0})
              </h3>
              {(detail?.scans.length ?? 0) === 0 ? (
                <div className="rounded-md border p-4 text-xs text-muted-foreground">
                  No scan history
                </div>
              ) : (
                <div className="space-y-2">
                  {detail!.scans.map((s) => (
                    <ScanCard
                      key={s.id}
                      scanId={s.id}
                      state={(s.status ?? "unscanned") as PackageScanState}
                      scanner={s.scanner}
                      scannedAt={s.scanned_at ?? s.created_at}
                      findings={s.findings}
                      canRefresh={
                        ready &&
                        s.status === "pending" &&
                        !refreshMutation.isPending
                      }
                      onRefresh={() => handleRefresh(s.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="mt-6 text-sm text-muted-foreground">
            Select a package to see its scan history.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ScanCard({
  scanId,
  state,
  scanner,
  scannedAt,
  findings,
  canRefresh,
  onRefresh,
}: {
  scanId: string;
  state: PackageScanState;
  scanner: string | null;
  scannedAt: string | null;
  findings: unknown;
  canRefresh: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const details = useAdminPackageScanDetails(open ? scanId : null);
  const counts = details.data?.counts;
  const items = details.data?.items ?? [];

  // Refresh visible when aggregate itself is pending OR the expanded details
  // report recoverable pending child items (aggregate may be terminal via
  // precedence even while child items remain pending).
  const showRefresh =
    state === "pending" || (open && (counts?.pending ?? 0) > 0);

  return (
    <div className="rounded-md border p-3 text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={statusTone(state)}>{statusLabel(state)}</Badge>
          <span className="text-muted-foreground">{scanner || "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          {showRefresh && (
            <Button
              size="sm"
              variant="outline"
              className="min-h-[44px]"
              disabled={!canRefresh}
              onClick={onRefresh}
              aria-label="Refresh scan status"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="min-h-[44px]"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? "Hide details" : "Details"}
          </Button>
        </div>
      </div>
      <div className="text-muted-foreground">
        {formatDateTime(scannedAt)}
      </div>


      {open && (
        <div className="rounded bg-muted/40 p-2 space-y-2">
          {details.isLoading ? (
            <div className="text-muted-foreground">Loading details…</div>
          ) : details.isError ? (
            <div className="text-destructive">
              {(details.error as Error).message}
            </div>
          ) : counts ? (
            <>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span>{counts.items} item{counts.items === 1 ? "" : "s"}</span>
                <span>progress {counts.progress_pct}%</span>
                <span>clean {counts.clean}</span>
                <span>pending {counts.pending}</span>
                <span>failed {counts.failed}</span>
                <span>suspicious {counts.suspicious}</span>
                <span>malicious {counts.malicious}</span>
                <span>
                  engines {counts.detected_engines}/{counts.total_engines}
                </span>
              </div>
              <div className="divide-y rounded border bg-background">
                {items.map((it) => (
                  <div key={it.id} className="p-2 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {it.file.file_name ?? "—"}
                      </span>
                      <Badge variant={statusTone(it.status)}>
                        {statusLabel(it.status)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-muted-foreground">
                      <span>progress {it.progress}%</span>
                      <span>
                        engines {it.detected_engines ?? 0}/{it.total_engines ?? 0}
                      </span>
                      <span>attempts {it.attempt_count}</span>
                      <span>{formatBytes(it.file.size_bytes)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {(findings || null) && (
                <pre className="whitespace-pre-wrap break-words rounded bg-background p-2 font-mono text-[10px]">
                  {formatFindings(findings)}
                </pre>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

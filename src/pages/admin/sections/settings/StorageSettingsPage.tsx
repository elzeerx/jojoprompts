import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  HardDrive,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  Info,
  FileArchive,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateTime } from "@/lib/v2/admin/format";
import { useAdminStorageSettingsStatus } from "@/hooks/admin/v2/useAdminStorageSettings";
import {
  bucketReadiness,
  formatBytes,
  STORAGE_NAV_LINKS,
  type StatusTone,
  type StorageSettingsStatus,
} from "@/lib/v2/admin/storageSettings";

function toneClass(tone: StatusTone): string {
  switch (tone) {
    case "ok": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "warn": return "bg-amber-100 text-amber-800 border-amber-200";
    case "danger": return "bg-red-100 text-red-800 border-red-200";
    case "info":
    default: return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function Metric({
  label, value, tone = "info",
}: { label: string; value: string | number; tone?: StatusTone }) {
  return (
    <div className="rounded-lg border bg-card p-3 min-h-[68px] flex flex-col justify-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums break-words ${
        tone === "danger" ? "text-red-700" :
        tone === "warn" ? "text-amber-700" :
        tone === "ok" ? "text-emerald-700" : ""
      }`}>
        {value}
      </div>
    </div>
  );
}

function readinessRows(status: StorageSettingsStatus) {
  const rows: { key: string; label: string; value: string; tone: StatusTone }[] = [];
  const readiness = bucketReadiness(status);
  rows.push({
    key: "provider", label: "Provider", value: "Supabase Storage", tone: "info",
  });
  rows.push({
    key: "bucket_id", label: "Bucket", value: status.bucket.id, tone: "info",
  });
  rows.push({
    key: "presence",
    label: "Bucket presence",
    value: status.bucket.present ? "Present" : "Missing",
    tone: status.bucket.present ? "ok" : "danger",
  });
  rows.push({
    key: "privacy",
    label: "Privacy",
    value: status.bucket.public === null
      ? "Unknown"
      : status.bucket.public ? "Public" : "Private",
    tone: status.bucket.public === false
      ? "ok"
      : status.bucket.public === true ? "danger" : "warn",
  });
  rows.push({
    key: "max_upload",
    label: "Application upload cap",
    value: formatBytes(status.application_contract.max_upload_bytes),
    tone: "info",
  });
  rows.push({
    key: "ready",
    label: "Overall readiness",
    value: readiness.reason,
    tone: readiness.ready ? "ok" : "warn",
  });
  return rows;
}

const BOUNDARIES: { key: string; label: string }[] = [
  { key: "bucket_object_existence", label: "Individual object existence in bucket" },
  { key: "signed_url_generation", label: "Signed URL generation" },
  { key: "storage_quota_capacity", label: "Storage quota / capacity" },
  { key: "service_runtime_health", label: "Upload/download/scanner runtime health" },
];

export default function StorageSettingsPage() {
  const statusQ = useAdminStorageSettingsStatus();

  const config = useMemo(
    () => (statusQ.data ? readinessRows(statusQ.data) : []),
    [statusQ.data],
  );

  const refresh = () => { void statusQ.refetch(); };
  const refreshing = statusQ.isFetching;
  const data = statusQ.data;
  const checksumPct = data && data.registry.registered_files > 0
    ? Math.round((data.registry.checksum_ready_files / data.registry.registered_files) * 100)
    : null;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <HardDrive className="h-6 w-6" aria-hidden />
            Storage settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only overview of the Supabase Storage bucket that backs
            resource package files, plus registry and scan coverage.
          </p>
          {data ? (
            <p className="text-xs text-muted-foreground mt-1">
              Last checked {formatDateTime(data.as_of)}
            </p>
          ) : null}
        </div>
        <Button
          variant="outline"
          onClick={refresh}
          disabled={refreshing}
          className="min-h-[44px] w-full sm:w-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2 min-w-0">
            {data && bucketReadiness(data).ready ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
            )}
            Configuration
          </CardTitle>
          <Badge variant="outline" className="text-xs shrink-0">Server-reported</Badge>
        </CardHeader>
        <CardContent>
          {statusQ.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : statusQ.isError || !data ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Unable to load configuration</AlertTitle>
              <AlertDescription>
                The admin storage status service did not respond. Retry using
                the Refresh button above.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {config.map((r) => (
                  <div
                    key={r.key}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3 gap-2"
                  >
                    <div className="text-sm">{r.label}</div>
                    <Badge
                      className={`border ${toneClass(r.tone)} whitespace-normal break-words text-left`}
                      variant="outline"
                    >
                      {r.value}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-muted-foreground break-words">
                Approved MIME types (application):{" "}
                {data.application_contract.approved_mime_types.join(", ")}
              </div>
              {data.bucket.allowed_mime_types && data.bucket.allowed_mime_types.length > 0 ? (
                <div className="mt-2 text-xs text-muted-foreground break-words">
                  Bucket-configured MIME types:{" "}
                  {data.bucket.allowed_mime_types.join(", ")}
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* Package registry */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2 min-w-0">
            <FileArchive className="h-4 w-4" aria-hidden />
            Package registry snapshot
          </CardTitle>
          <Badge variant="outline" className="text-xs shrink-0">All-time</Badge>
        </CardHeader>
        <CardContent>
          {statusQ.isLoading || !data ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric label="Registered files" value={data.registry.registered_files} />
              <Metric label="Total bytes" value={formatBytes(data.registry.registered_bytes)} />
              <Metric
                label="Checksum coverage"
                value={checksumPct === null ? "—" : `${checksumPct}%`}
              />
              <Metric
                label="Last registered"
                value={
                  data.registry.last_registered_at
                    ? formatDateTime(data.registry.last_registered_at)
                    : "—"
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scan coverage</CardTitle>
        </CardHeader>
        <CardContent>
          {statusQ.isLoading || !data ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Metric label="Clean" value={data.scan_counts.clean} tone="ok" />
              <Metric label="Pending" value={data.scan_counts.pending} tone="info" />
              <Metric label="Suspicious" value={data.scan_counts.suspicious} tone="danger" />
              <Metric label="Malicious" value={data.scan_counts.malicious} tone="danger" />
              <Metric label="Failed" value={data.scan_counts.failed} tone="warn" />
              <Metric label="Unscanned" value={data.scan_counts.unscanned} tone="warn" />
            </div>
          )}
          <div className="mt-3 text-xs text-muted-foreground">
            Buckets are mutually exclusive; the sum equals total registered files.
            Per latest-scan status.
          </div>
        </CardContent>
      </Card>

      {/* Downloads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2 min-w-0">
            <Download className="h-4 w-4" aria-hidden />
            Download authorizations
          </CardTitle>
          <Badge variant="outline" className="text-xs shrink-0">Last 24 hours</Badge>
        </CardHeader>
        <CardContent>
          {statusQ.isLoading || !data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Metric label="Authorized (24h)" value={data.downloads.authorized_24h} />
              <Metric
                label="Last authorized"
                value={
                  data.downloads.last_authorized_at
                    ? formatDateTime(data.downloads.last_authorized_at)
                    : "—"
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Secure delivery contract */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Secure delivery contract</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Application contract, not live health</AlertTitle>
            <AlertDescription>
              These are the application-level rules enforced by the deployed
              services. Runtime health of these services is not probed here.
            </AlertDescription>
          </Alert>
          {data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-lg border p-3 min-h-[68px]">
                <div className="text-xs text-muted-foreground">Admin upload</div>
                <div className="text-sm font-medium break-words">
                  {data.application_contract.admin_upload_service}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Auth: JWT-verified admin · Cap {formatBytes(data.application_contract.max_upload_bytes)}
                </div>
              </div>
              <div className="rounded-lg border p-3 min-h-[68px]">
                <div className="text-xs text-muted-foreground">Customer download</div>
                <div className="text-sm font-medium break-words">
                  {data.application_contract.customer_download_service}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Custom bearer + server-side entitlement RPC · {data.application_contract.signed_url_ttl_seconds}s signed URL
                </div>
              </div>
              <div className="rounded-lg border p-3 min-h-[68px]">
                <div className="text-xs text-muted-foreground">Scan control</div>
                <div className="text-sm font-medium break-words">
                  {data.application_contract.package_scan_control_service}
                </div>
              </div>
              <div className="rounded-lg border p-3 min-h-[68px]">
                <div className="text-xs text-muted-foreground">Scan worker</div>
                <div className="text-sm font-medium break-words">
                  {data.application_contract.package_scan_worker_service}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Verification boundaries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification boundaries</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertTitle>What this page reports</AlertTitle>
            <AlertDescription>
              This page reports live bucket configuration (via bucket listing)
              plus aggregate registry, scan, and download-authorization counts.
              It does not upload, download, sign URLs, list bucket objects,
              call the scanner provider, or probe runtime health.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BOUNDARIES.map((b) => (
              <div
                key={b.key}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border p-3 gap-2"
              >
                <div className="text-sm">{b.label}</div>
                <Badge
                  className={`border ${toneClass("info")} whitespace-normal break-words text-left`}
                  variant="outline"
                >
                  Not checked here
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Related admin surfaces</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STORAGE_NAV_LINKS.map((n) => (
            <Button
              key={n.to}
              asChild
              variant="outline"
              className="h-auto min-h-[64px] justify-start text-left"
            >
              <Link to={n.to} className="flex flex-col items-start gap-1 py-2">
                <span className="font-medium flex items-center gap-1">
                  {n.label}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </span>
                <span className="text-xs text-muted-foreground">{n.description}</span>
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

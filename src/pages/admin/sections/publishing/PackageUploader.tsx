// PackageUploader — private package upload UI for skill/automation resources.
//
// Preconditions enforced by the parent (ResourcePublisher):
//   - Resource has been saved at least once (resourceId is a UUID).
//   - Resource has a currentVersionId (returned by save_admin_resource_draft).
//   - Resource type is 'skill' or 'automation'.
//
// Flow:
//   1) User picks a file.
//   2) Compute SHA-256 in the browser (client-declared, stored as such).
//   3) POST { action: "create_upload", ... } to admin-package-upload → get signed URL.
//   4) PUT the file bytes to Supabase storage via uploadToSignedUrl.
//   5) POST { action: "finalize_upload", ... } → server verifies size in storage
//      and enqueues a pending scan. Publishing remains blocked until clean.
//
// The scanner is NOT invented here. This UI only surfaces "Scan pending" until
// an external scanner marks the version clean.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, ShieldAlert, FileArchive } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type Props = {
  resourceId: string;
  resourceVersionId: string;
  resourceType: "skill" | "automation";
};

type ScanStatus = "pending" | "clean" | "suspicious" | "malicious" | "failed";

const BUCKET = "resource-packages";
const ALLOWED_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "application/json",
  "text/plain",
];
const MAX_BYTES = 200 * 1024 * 1024;
const SAFE_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function scanBadge(status: ScanStatus | null) {
  if (status === "clean") return <Badge className="bg-emerald-600 text-white">Clean</Badge>;
  if (status === "pending") return <Badge variant="secondary">Scan pending</Badge>;
  if (status === "suspicious") return <Badge className="bg-amber-500 text-white">Suspicious</Badge>;
  if (status === "malicious") return <Badge className="bg-red-600 text-white">Malicious</Badge>;
  if (status === "failed") return <Badge className="bg-red-500 text-white">Scan failed</Badge>;
  return <Badge variant="outline">No scan yet</Badge>;
}

export function PackageUploader({ resourceId, resourceVersionId, resourceType }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");

  // Load existing files on this version + latest scan.
  const filesQ = useQuery({
    queryKey: ["admin", "package-files", resourceVersionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_files")
        .select("id, file_name, size_bytes, content_type, created_at, storage_path")
        .eq("resource_version_id", resourceVersionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const scanQ = useQuery({
    queryKey: ["admin", "package-scan", resourceVersionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_scans")
        .select("status, created_at, scanned_at, findings")
        .eq("resource_version_id", resourceVersionId)
        .order("created_at", { ascending: false })
        .order("scanned_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const latestStatus: ScanStatus | null =
    (scanQ.data?.status as ScanStatus | undefined) ?? null;

  const filePreflight = useMemo(() => {
    if (!file) return null;
    if (!SAFE_FILE_RE.test(file.name)) return "File name may only contain letters, numbers, dot, dash, underscore.";
    if (file.size <= 0 || file.size > MAX_BYTES) return `File must be 1..${formatBytes(MAX_BYTES)}.`;
    const ct = file.type || "application/octet-stream";
    if (!ALLOWED_TYPES.includes(ct)) return `Content type ${ct} not allowed. Zip your package first.`;
    return null;
  }, [file]);

  useEffect(() => {
    if (!busy) setProgress("");
  }, [busy]);

  const doUpload = async () => {
    if (!file || filePreflight) return;
    setBusy(true);
    try {
      setProgress("Hashing file…");
      const checksum = await sha256Hex(file);

      setProgress("Requesting upload URL…");
      const { data: created, error: cErr } = await supabase.functions.invoke(
        "admin-package-upload",
        {
          body: {
            action: "create_upload",
            resource_id: resourceId,
            resource_version_id: resourceVersionId,
            file_name: file.name,
            size_bytes: file.size,
            content_type: file.type || "application/octet-stream",
          },
        },
      );
      if (cErr || !created?.path || !created?.token) {
        throw new Error(cErr?.message ?? created?.message ?? "Failed to obtain upload URL");
      }

      setProgress("Uploading to storage…");
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(created.path, created.token, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

      setProgress("Finalizing and enqueueing scan…");
      const { data: fin, error: fErr } = await supabase.functions.invoke(
        "admin-package-upload",
        {
          body: {
            action: "finalize_upload",
            resource_id: resourceId,
            resource_version_id: resourceVersionId,
            path: created.path,
            file_name: file.name,
            size_bytes: file.size,
            content_type: file.type || "application/octet-stream",
            checksum_sha256_client: checksum,
          },
        },
      );
      if (fErr || !fin?.ok) {
        throw new Error(fErr?.message ?? fin?.message ?? "Finalize failed");
      }

      toast({
        title: "Upload finalized",
        description: "Scan pending. Publishing stays blocked until a scanner marks it clean.",
      });
      setFile(null);
      qc.invalidateQueries({ queryKey: ["admin", "package-files", resourceVersionId] });
      qc.invalidateQueries({ queryKey: ["admin", "package-scan", resourceVersionId] });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <FileArchive className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Package files</span>
          <span className="text-muted-foreground">— {resourceType} · version files</span>
        </div>
        <div>{scanBadge(latestStatus)}</div>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          Scan pending; publishing remains blocked until a scanner marks it clean.
          Checksums shown here are client-declared and are not proof of integrity —
          only a successful scan is.
        </AlertDescription>
      </Alert>

      <div className="rounded-md border p-3">
        <input
          type="file"
          accept=".zip,application/zip,application/octet-stream,application/json,text/plain"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
          className="block w-full text-sm"
        />
        {file && (
          <div className="mt-2 text-xs text-muted-foreground">
            {file.name} · {formatBytes(file.size)} · {file.type || "application/octet-stream"}
          </div>
        )}
        {filePreflight && (
          <div className="mt-2 text-xs text-red-600">{filePreflight}</div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <Button onClick={doUpload} disabled={!file || !!filePreflight || busy} size="sm">
            {busy ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Upload className="h-4 w-4 me-2" />}
            Upload
          </Button>
          {busy && <span className="text-xs text-muted-foreground">{progress}</span>}
        </div>
      </div>

      <div className="rounded-md border">
        <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
          Files on current version
        </div>
        {filesQ.isLoading ? (
          <div className="p-3 text-sm text-muted-foreground">Loading…</div>
        ) : (filesQ.data ?? []).length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">
            No files uploaded yet for this version.
          </div>
        ) : (
          <ul className="divide-y">
            {(filesQ.data ?? []).map((f) => (
              <li key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{f.file_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(f.size_bytes ?? 0)} · {f.content_type ?? "unknown"}
                  </div>
                </div>
                <div className="ms-3 shrink-0 text-xs text-muted-foreground">
                  {new Date(f.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

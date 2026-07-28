// PackageUploader — private package upload UI for skill/automation resources.
//
// Preconditions enforced by the parent (ResourcePublisher):
//   - Resource has been saved at least once (resourceId is a UUID).
//   - Resource has a currentVersionId (returned by save_admin_resource_draft).
//   - Resource type is 'skill' or 'automation'.
//
// Flow (V2 hardened):
//   1) User picks a file.
//   2) Preflight extension + size on the client (server is authoritative).
//   3) POST multipart { version_id, file } → v2-admin-upload-resource-file.
//      The Edge Function verifies admin role, size, extension/MIME, computes
//      the SHA-256 server-side, stores privately, and registers via SECURITY
//      DEFINER RPC. Package scans remain gated by the scanner slice.
//   4) On success we invalidate the files + scan queries and reset the input.
//
// This UI intentionally invokes ONLY the V2 upload Edge Function. The
// legacy two-step upload slug is retired at source.

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, ShieldAlert, FileArchive, RotateCcw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type Props = {
  resourceId: string;
  resourceVersionId: string;
  resourceType: "skill" | "automation";
};

type ScanStatus = "pending" | "clean" | "suspicious" | "malicious" | "failed";

// Extensions accepted by v2-admin-upload-resource-file. Server validation is authoritative.
const ACCEPT_ATTR =
  ".zip,.md,.markdown,.json,.yaml,.yml,.txt,application/zip,application/json,text/markdown,text/plain,application/yaml,application/x-yaml,text/yaml,text/x-yaml";
const ALLOWED_EXT = new Set(["zip", "md", "markdown", "json", "yaml", "yml", "txt"]);
const MAX_BYTES = 25 * 1024 * 1024;

const ERR_LABEL: Record<string, string> = {
  invalid_extension: "That file type is not allowed.",
  invalid_content_type: "Content type does not match the file extension.",
  invalid_file_name: "File name is not allowed.",
  invalid_file_size: "File must be 1 byte – 25 MB.",
  invalid_version_id: "Invalid version id.",
  missing_file: "No file selected.",
  too_many_files: "Only one file per upload.",
  forbidden: "You do not have permission to upload.",
  unauthorized: "Please sign in again.",
  version_not_found: "Version no longer exists.",
  upload_failed: "Storage upload failed — please try again.",
  registration_failed: "Registration failed — please try again.",
};

function extOf(name: string): string | null {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return null;
  return name.slice(i + 1).toLowerCase();
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

export function PackageUploader({ resourceId: _resourceId, resourceVersionId, resourceType }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const inputId = `pkg-upload-${resourceVersionId}`;

  // Load existing files on this version + latest scan.
  const filesQ = useQuery({
    queryKey: ["admin", "package-files", resourceVersionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resource_files")
        .select("id, file_name, size_bytes, content_type, created_at")
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
    const ext = extOf(file.name);
    if (!ext || !ALLOWED_EXT.has(ext)) {
      return `File type .${ext ?? "?"} not allowed. Accepted: .zip, .md, .markdown, .json, .yaml, .yml, .txt.`;
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return `File must be 1 byte – ${formatBytes(MAX_BYTES)}.`;
    }
    return null;
  }, [file]);

  useEffect(() => {
    if (!busy) setProgress("");
  }, [busy]);

  const resetInput = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const doUpload = async () => {
    if (!file || filePreflight) return;
    setBusy(true);
    setProgress("Uploading package…");
    try {
      const form = new FormData();
      form.append("version_id", resourceVersionId);
      form.append("file", file);

      const { data, error } = await supabase.functions.invoke(
        "v2-admin-upload-resource-file",
        { body: form },
      );

      if (error) {
        let code: string | undefined;
        try {
          const ctx = (error as unknown as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            const parsed = await ctx.json();
            code = parsed?.error;
          }
        } catch { /* noop */ }
        throw new Error(ERR_LABEL[code ?? ""] ?? "Upload failed. Please try again.");
      }

      const uploaded = (data as { file?: { file_name?: string } })?.file;
      toast({
        title: "Upload complete",
        description: `${uploaded?.file_name ?? file.name} · scan pending. Publishing stays blocked until it is marked clean.`,
      });
      resetInput();
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <FileArchive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">Package files</span>
          <span className="text-muted-foreground">— {resourceType} · version files</span>
        </div>
        <div>{scanBadge(latestStatus)}</div>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        <AlertDescription>
          Scan pending; publishing remains blocked until a scanner marks it clean.
          Uploads are limited to 25 MB. The server computes and verifies the SHA-256 —
          only a successful scan proves integrity.
        </AlertDescription>
      </Alert>

      <div className="rounded-md border p-3">
        <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-dark-base">
          Choose a package file
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
          aria-describedby={`${inputId}-help`}
          className="block w-full text-sm file:me-3 file:min-h-[44px] file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm"
        />
        <p id={`${inputId}-help`} className="mt-1 text-[11px] text-muted-foreground">
          Accepted: .zip, .md, .markdown, .json, .yaml, .yml, .txt · max 25 MB · one file per upload.
        </p>
        {file && (
          <div className="mt-2 truncate text-xs text-muted-foreground">
            <span className="font-medium text-dark-base">{file.name}</span>
            {" · "}{formatBytes(file.size)}
            {file.type ? ` · ${file.type}` : ""}
          </div>
        )}
        {filePreflight && (
          <div className="mt-2 text-xs text-red-600" role="alert">{filePreflight}</div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={doUpload}
            disabled={!file || !!filePreflight || busy}
            aria-busy={busy}
            className="min-h-[44px]"
          >
            {busy
              ? <Loader2 className="h-4 w-4 me-2 animate-spin" aria-hidden="true" />
              : <Upload className="h-4 w-4 me-2" aria-hidden="true" />}
            {busy ? "Uploading…" : "Upload"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={resetInput}
            disabled={busy || !file}
            className="min-h-[44px]"
          >
            <RotateCcw className="h-4 w-4 me-2" aria-hidden="true" />
            Reset
          </Button>
          <span className="text-xs text-muted-foreground" aria-live="polite" role="status">
            {busy ? progress : ""}
          </span>
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
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
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

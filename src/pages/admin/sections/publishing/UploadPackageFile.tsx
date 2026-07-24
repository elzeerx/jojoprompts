import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { adminResourceVersionsKeys } from "@/hooks/admin/v2/useAdminResourceVersions";

interface Props {
  versionId: string;
}

// Extensions accepted by the edge function. Server validation is authoritative.
const ACCEPT_ATTR =
  ".zip,.md,.markdown,.json,.yaml,.yml,.txt,application/zip,application/json,text/markdown,text/plain,application/yaml,application/x-yaml,text/yaml,text/x-yaml";
const ALLOWED_EXT = new Set([
  "zip",
  "md",
  "markdown",
  "json",
  "yaml",
  "yml",
  "txt",
]);
const MAX_BYTES = 25 * 1024 * 1024;

function extOf(name: string): string | null {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return null;
  return name.slice(i + 1).toLowerCase();
}

const ERR_LABEL: Record<string, string> = {
  invalid_extension: "That file type is not allowed",
  invalid_content_type: "Content type does not match the file extension",
  invalid_file_name: "File name is not allowed",
  invalid_file_size: "File must be 1 byte – 25 MB",
  invalid_version_id: "Invalid version id",
  missing_file: "No file selected",
  too_many_files: "Only one file per upload",
  forbidden: "You do not have permission to upload",
  unauthorized: "Please sign in again",
  version_not_found: "Version no longer exists",
  upload_failed: "Storage upload failed — please try again",
  registration_failed: "Registration failed — please try again",
};

export function UploadPackageFile({ versionId }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    const ext = extOf(file.name);
    if (!ext || !ALLOWED_EXT.has(ext)) {
      toast.error(ERR_LABEL.invalid_extension);
      return;
    }
    if (file.size < 1 || file.size > MAX_BYTES) {
      toast.error(ERR_LABEL.invalid_file_size);
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("version_id", versionId);
      form.append("file", file);
      const { data, error } = await supabase.functions.invoke(
        "v2-admin-upload-resource-file",
        { body: form },
      );
      if (error) {
        // FunctionsHttpError body may be in error.context (Response) — attempt to parse
        let code: string | undefined;
        try {
          const ctx = (error as unknown as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            const parsed = await ctx.json();
            code = parsed?.error;
          }
        } catch { /* noop */ }
        toast.error(ERR_LABEL[code ?? ""] ?? "Upload failed");
        return;
      }
      const uploaded = (data as { file?: { file_name?: string } })?.file;
      toast.success(`Uploaded ${uploaded?.file_name ?? file.name}`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: adminResourceVersionsKeys.detail(versionId) }),
        qc.invalidateQueries({ queryKey: ["admin", "v2", "resource-versions", "list"] }),
      ]);
    } catch (err) {
      console.error("upload error", err);
      toast.error("Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={`upload-file-${versionId}`}
        type="file"
        className="sr-only"
        accept={ACCEPT_ATTR}
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] w-full sm:w-auto"
        disabled={busy}
        aria-busy={busy}
        aria-controls={`upload-file-${versionId}`}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
        {busy ? "Uploading…" : "Upload package file"}
      </Button>
      <p className="text-[11px] text-muted-foreground" aria-live="polite">
        Accepted: .zip, .md, .markdown, .json, .yaml, .yml, .txt · max 25 MB · one file per upload
      </p>
    </div>
  );
}

// v2-admin-upload-resource-file
// Admin-only secure package file ingestion for a resource_version.
// - JWT verified via getUser(); admin role required.
// - Accepts a single multipart file; enforces 25 MiB cap and strict extension/MIME set.
// - Uploads to private `resource-packages` under `<version_id>/<uuid>/<safe-basename>`.
// - Registers via SECURITY DEFINER RPC v2_internal_register_resource_file.
// - On registration failure, deletes the uploaded object as compensating cleanup.
// - Never leaks storage bucket/path/checksum in errors.
//
// Note: A `package_scans` row is NOT created here. Files remain `unscanned`
// and blocked from customer download until the scanner slice arrives.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUCKET = "resource-packages";
const MAX_BYTES = 25 * 1024 * 1024; // 26214400

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[a-f0-9]{64}$/;

// Extension -> allowed MIME set. `application/octet-stream` is only allowed for .zip
// because browsers commonly label ZIP that way.
const EXT_MIME: Record<string, ReadonlySet<string>> = {
  zip: new Set([
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
  ]),
  md: new Set(["text/markdown", "text/plain"]),
  markdown: new Set(["text/markdown", "text/plain"]),
  json: new Set(["application/json", "text/plain"]),
  yaml: new Set([
    "application/yaml",
    "application/x-yaml",
    "text/yaml",
    "text/x-yaml",
    "text/plain",
  ]),
  yml: new Set([
    "application/yaml",
    "application/x-yaml",
    "text/yaml",
    "text/x-yaml",
    "text/plain",
  ]),
  txt: new Set(["text/plain"]),
};

// Canonical RPC content_type stored for each extension.
const CANONICAL_CT: Record<string, string> = {
  zip: "application/zip",
  md: "text/markdown",
  markdown: "text/markdown",
  json: "application/json",
  yaml: "application/yaml",
  yml: "application/yaml",
  txt: "text/plain",
};

export function extOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toLowerCase();
}

// Normalise a display basename: strip directory parts, forbid control chars/traversal.
// Preserves Unicode (e.g. Arabic) characters. Returns null if unsafe.
export function safeBasename(raw: string): string | null {
  if (!raw) return null;
  if (raw.includes("/") || raw.includes("\\")) return null;
  if (raw === "." || raw === "..") return null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return null;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 180) return null;
  return trimmed;
}

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const out = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < out.length; i++) {
    hex += out[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export function buildStoragePath(
  versionId: string,
  innerUuid: string,
  basename: string,
): string {
  return `${versionId}/${innerUuid}/${basename}`;
}

export interface UploadValidation {
  ok: boolean;
  error?: string;
  ext?: string;
  canonicalCt?: string;
  basename?: string;
}

export function validateUpload(input: {
  versionId: string;
  fileName: string;
  size: number;
  mime: string;
}): UploadValidation {
  if (!isUuid(input.versionId)) return { ok: false, error: "invalid_version_id" };
  const basename = safeBasename(input.fileName);
  if (!basename) return { ok: false, error: "invalid_file_name" };
  const ext = extOf(basename);
  if (!ext || !(ext in EXT_MIME)) return { ok: false, error: "invalid_extension" };
  if (!EXT_MIME[ext].has(input.mime)) return { ok: false, error: "invalid_content_type" };
  if (!Number.isFinite(input.size) || input.size < 1 || input.size > MAX_BYTES) {
    return { ok: false, error: "invalid_file_size" };
  }
  return { ok: true, ext, canonicalCt: CANONICAL_CT[ext], basename };
}

interface ErrorBody { error: string; code?: string }
function json(body: ErrorBody | Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---- Injectable dependencies for testability ----
export interface StorageDeps {
  upload(
    path: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<{ error?: { message: string } | null }>;
  remove(path: string): Promise<void>;
}

export interface HandlerDeps {
  getUserId: (authHeader: string) => Promise<string | null>;
  isAdmin: (userId: string) => Promise<boolean>;
  storage: StorageDeps;
  registerFile: (args: {
    actorUserId: string;
    versionId: string;
    storagePath: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    checksumSha256: string;
  }) => Promise<{ data?: unknown; error?: { message: string } | null }>;
  newInnerUuid?: () => string;
}

export async function handleRequest(req: Request, deps: HandlerDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }

  const userId = await deps.getUserId(authHeader);
  if (!userId) return json({ error: "unauthorized" }, 401);

  const admin = await deps.isAdmin(userId);
  if (!admin) return json({ error: "forbidden" }, 403);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "invalid_multipart" }, 400);
  }

  const versionId = String(form.get("version_id") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "missing_file" }, 400);

  let fileCount = 0;
  for (const [, v] of form.entries()) if (v instanceof File) fileCount++;
  if (fileCount !== 1) return json({ error: "too_many_files" }, 400);

  const validation = validateUpload({
    versionId,
    fileName: file.name,
    size: file.size,
    mime: file.type,
  });
  if (!validation.ok) return json({ error: validation.error! }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size || bytes.byteLength < 1 || bytes.byteLength > MAX_BYTES) {
    return json({ error: "invalid_file_size" }, 400);
  }
  const checksum = await sha256Hex(bytes);
  if (!HEX64_RE.test(checksum)) return json({ error: "invalid_checksum" }, 500);

  const innerUuid = (deps.newInnerUuid ?? crypto.randomUUID.bind(crypto))();
  const path = buildStoragePath(versionId, innerUuid, validation.basename!);

  const upRes = await deps.storage.upload(path, bytes, validation.canonicalCt!);
  if (upRes.error) {
    console.error("upload_failed");
    return json({ error: "upload_failed" }, 502);
  }

  const reg = await deps.registerFile({
    actorUserId: userId,
    versionId,
    storagePath: path,
    fileName: validation.basename!,
    contentType: validation.canonicalCt!,
    sizeBytes: file.size,
    checksumSha256: checksum,
  });
  if (reg.error) {
    await deps.storage.remove(path).catch(() => {});
    const msg = reg.error.message ?? "";
    console.error("register_failed");
    if (msg.includes("forbidden")) return json({ error: "forbidden" }, 403);
    if (msg.includes("version_not_found")) return json({ error: "version_not_found" }, 404);
    if (msg.includes("invalid_file_name")) return json({ error: "invalid_file_name" }, 400);
    if (msg.includes("invalid_storage_path")) return json({ error: "invalid_storage_path" }, 400);
    if (msg.includes("invalid_file_size")) return json({ error: "invalid_file_size" }, 400);
    if (msg.includes("invalid_checksum")) return json({ error: "invalid_checksum" }, 400);
    if (msg.includes("invalid_content_type")) return json({ error: "invalid_content_type" }, 400);
    return json({ error: "registration_failed" }, 502);
  }

  // Return only safe metadata (already produced by RPC). Never leak storage path.
  const safe = reg.data && typeof reg.data === "object" ? (reg.data as Record<string, unknown>) : {};
  const safeOut = {
    file_id: safe.file_id,
    file_name: safe.file_name,
    content_type: safe.content_type,
    size_bytes: safe.size_bytes,
    created_at: safe.created_at,
  };
  return json({ ok: true, file: safeOut }, 200);
}

function buildProdDeps(): HandlerDeps {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async getUserId(authHeader) {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error } = await userClient.auth.getUser();
      if (error || !data?.user) return null;
      return data.user.id;
    },
    async isAdmin(userId) {
      const { data, error } = await admin.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      return !error && !!data;
    },
    storage: {
      async upload(path, bytes, contentType) {
        const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
          contentType,
          upsert: false,
        });
        return { error: error ? { message: error.message } : null };
      },
      async remove(path) {
        await admin.storage.from(BUCKET).remove([path]);
      },
    },
    async registerFile(a) {
      const { data, error } = await admin.rpc("v2_internal_register_resource_file", {
        p_actor_user_id: a.actorUserId,
        p_version_id: a.versionId,
        p_storage_path: a.storagePath,
        p_file_name: a.fileName,
        p_content_type: a.contentType,
        p_size_bytes: a.sizeBytes,
        p_checksum_sha256: a.checksumSha256,
      });
      return { data, error: error ? { message: error.message } : null };
    },
  };
}

// Only bind Deno.serve when running as an edge function, not during tests.
if (!Deno.env.get("V2_UPLOAD_TEST_MODE")) {
  Deno.serve((req) => handleRequest(req, buildProdDeps()));
}

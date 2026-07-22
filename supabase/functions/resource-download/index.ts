// resource-download
// Server-authoritative signed download for V2 resource files.
// - Verifies the caller's bearer JWT via a user-scoped client.
// - Invokes the server-only authorization RPC through the service-role client
//   passing the *verified* user id extracted from the JWT. No caller-supplied
//   user id is ever honored.
// - Returns only a 60s signed URL + safe file metadata. Never returns storage
//   bucket / path / service keys / scan findings.

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set<string>([
  "https://jojoprompts.com",
  "https://www.jojoprompts.com",
  "https://jojoprompts.lovable.app",
  "https://id-preview--766f3370-d38c-42e5-8566-5e4946986dd2.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
]);

function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  // Only echo Allow-Origin for known origins. For disallowed origins we omit
  // the header entirely so browsers block the response.
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const ERRORS = {
  UNAUTHENTICATED: { code: "unauthenticated", message: "Authentication required." },
  FORBIDDEN: { code: "forbidden", message: "Not authorized to download this file." },
  UNAVAILABLE: { code: "unavailable", message: "This package is not available for download." },
  BAD_REQUEST: { code: "bad_request", message: "Invalid request." },
  SERVER: { code: "server_error", message: "Server error." },
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  const cors = buildCors(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") {
    return json(ERRORS.BAD_REQUEST, 405, cors);
  }

  // Strict body validation: object with exactly one known key.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(ERRORS.BAD_REQUEST, 400, cors);
  }
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return json(ERRORS.BAD_REQUEST, 400, cors);
  }
  const keys = Object.keys(body as Record<string, unknown>);
  if (keys.length !== 1 || keys[0] !== "resource_file_id") {
    return json(ERRORS.BAD_REQUEST, 400, cors);
  }
  const fileId = (body as { resource_file_id?: unknown }).resource_file_id;
  if (typeof fileId !== "string" || !UUID_RE.test(fileId)) {
    return json(ERRORS.BAD_REQUEST, 400, cors);
  }

  // Require bearer token.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(ERRORS.UNAUTHENTICATED, 401, cors);
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) return json(ERRORS.UNAUTHENTICATED, 401, cors);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Identity: user-scoped client. Never log the JWT.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string;
  try {
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(jwt);
    if (claimsErr || !claims?.claims?.sub) {
      return json(ERRORS.UNAUTHENTICATED, 401, cors);
    }
    userId = claims.claims.sub as string;
  } catch {
    return json(ERRORS.UNAUTHENTICATED, 401, cors);
  }
  if (!UUID_RE.test(userId)) {
    return json(ERRORS.UNAUTHENTICATED, 401, cors);
  }

  // Service-role client: sole caller of the server-only authorization RPC.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authzRows, error: authzErr } = await admin.rpc(
    "authorize_resource_download",
    { p_file_id: fileId, p_user_id: userId },
  );

  if (authzErr) {
    const code = (authzErr as { code?: string }).code;
    if (code === "28000") return json(ERRORS.UNAUTHENTICATED, 401, cors);
    if (code === "42501") {
      const msg = (authzErr.message || "").toLowerCase();
      if (msg.includes("package unavailable")) {
        return json(ERRORS.UNAVAILABLE, 403, cors);
      }
      return json(ERRORS.FORBIDDEN, 403, cors);
    }
    console.error("authorize_resource_download error", { code });
    return json(ERRORS.SERVER, 500, cors);
  }

  const row = Array.isArray(authzRows) ? authzRows[0] : authzRows;
  if (!row?.storage_bucket || !row?.storage_path) {
    return json(ERRORS.FORBIDDEN, 403, cors);
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(row.storage_bucket as string)
    .createSignedUrl(row.storage_path as string, 60, {
      download: row.file_name as string | undefined,
    });

  if (signErr || !signed?.signedUrl) {
    console.error("signed url error");
    return json(ERRORS.SERVER, 500, cors);
  }

  try {
    await admin.from("activity_events").insert({
      actor_user_id: userId,
      actor_type: "user",
      entity_type: "resource_file",
      entity_id: fileId,
      action: "download_authorized",
      metadata: { file_name: row.file_name ?? null },
    });
  } catch (_) {
    // audit failure must not block downloads
  }

  // Response never includes storage bucket/path.
  return json(
    {
      url: signed.signedUrl,
      expires_in: 60,
      file_name: row.file_name ?? null,
      content_type: row.content_type ?? null,
    },
    200,
    cors,
  );
});

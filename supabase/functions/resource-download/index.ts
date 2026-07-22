// resource-download
// Server-authoritative signed download for V2 resource files.
// Requires a valid Supabase user JWT. Authorizes via SECURITY DEFINER RPC,
// then issues a 60-second private signed URL. Never accepts a caller-provided
// bucket/path.

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
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://jojoprompts.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Stable, non-enumerating error codes
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

  // Parse & validate body strictly
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(ERRORS.BAD_REQUEST, 400, cors);
  }
  const fileId = (body as { resource_file_id?: unknown })?.resource_file_id;
  if (typeof fileId !== "string" || !UUID_RE.test(fileId)) {
    return json(ERRORS.BAD_REQUEST, 400, cors);
  }

  // Require bearer token
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(ERRORS.UNAUTHENTICATED, 401, cors);
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) return json(ERRORS.UNAUTHENTICATED, 401, cors);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Identity: user-scoped client. Never leak the JWT to logs.
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


  // Service client only for RPC (SECURITY DEFINER still checks auth.uid via user client)
  // We route the authorization RPC through the USER client so auth.uid() resolves.
  const { data: authzRows, error: authzErr } = await userClient.rpc(
    "authorize_resource_download",
    { p_file_id: fileId },
  );

  if (authzErr) {
    // Map postgres error codes without leaking details
    const code = (authzErr as { code?: string }).code;
    if (code === "28000") return json(ERRORS.UNAUTHENTICATED, 401, cors);
    if (code === "42501") {
      // Distinguish scan-gate vs authorization by message; both surface as 403
      const msg = (authzErr.message || "").toLowerCase();
      if (msg.includes("package unavailable")) {
        return json(ERRORS.UNAVAILABLE, 403, cors);
      }
      return json(ERRORS.FORBIDDEN, 403, cors);
    }
    console.error("authorize_resource_download error", { code, userId });
    return json(ERRORS.SERVER, 500, cors);
  }

  const row = Array.isArray(authzRows) ? authzRows[0] : authzRows;
  if (!row?.storage_bucket || !row?.storage_path) {
    return json(ERRORS.FORBIDDEN, 403, cors);
  }

  // Service client for signed URL only. Never returned to caller.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signed, error: signErr } = await admin.storage
    .from(row.storage_bucket as string)
    .createSignedUrl(row.storage_path as string, 60, {
      download: row.file_name as string | undefined,
    });

  if (signErr || !signed?.signedUrl) {
    console.error("signed url error", { userId });
    return json(ERRORS.SERVER, 500, cors);
  }

  // Best-effort server-side audit; do not fail the request if it errors.
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
    // swallow: audit failure must not block downloads
  }

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

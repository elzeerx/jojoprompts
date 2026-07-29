import { createClient } from "npm:@supabase/supabase-js@2";
import {
  environmentForOrigin,
  toSamples,
  validateWebVitalBatch,
} from "./validation.ts";

const MAX_BODY_BYTES = 4 * 1024;
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const requestWindows = new Map<string, { count: number; resetAt: number }>();
let retentionChecked = false;

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": environmentForOrigin(origin) ? origin! : "",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function json(
  origin: string | null,
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

function requestKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return (
    req.headers.get("cf-connecting-ip") ||
    forwarded?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function isRateLimited(req: Request, now = Date.now()): boolean {
  const key = requestKey(req);
  const current = requestWindows.get(key);
  if (!current || current.resetAt <= now) {
    requestWindows.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (requestWindows.size > 2_000) {
      for (const [candidate, window] of requestWindows) {
        if (window.resetAt <= now) requestWindows.delete(candidate);
      }
    }
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

async function readJson(req: Request): Promise<
  { ok: true; value: unknown } | { ok: false; status: number; error: string }
> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "request_too_large" };
  }
  const bytes = await req.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "request_too_large" };
  }
  try {
    return {
      ok: true,
      value: JSON.parse(new TextDecoder().decode(bytes)),
    };
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const environment = environmentForOrigin(origin);

  if (!environment) {
    return json(origin, 403, { error: "origin_not_allowed" });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json(origin, 405, { error: "method_not_allowed" });
  }
  if (isRateLimited(req)) {
    return json(origin, 429, { error: "rate_limited" });
  }

  const parsed = await readJson(req);
  if (!parsed.ok) {
    return json(origin, parsed.status, { error: parsed.error });
  }
  const validated = validateWebVitalBatch(parsed.value);
  if (!validated.ok) {
    return json(origin, 400, { error: validated.error });
  }

  const service = serviceClient();
  const samples = toSamples(validated.value, environment);
  const { error } = await service
    .from("web_vital_samples")
    .upsert(samples, {
      onConflict: "environment,metric_name,metric_id",
      ignoreDuplicates: true,
    });

  if (error) {
    // Do not log request payloads or transient network identifiers.
    console.error("v2-web-vitals insert failed", { code: error.code });
    return json(origin, 500, { error: "ingestion_failed" });
  }

  if (!retentionChecked) {
    retentionChecked = true;
    const { error: retentionError } = await service.rpc(
      "purge_expired_web_vital_samples",
    );
    if (retentionError) {
      console.error("v2-web-vitals retention failed", {
        code: retentionError.code,
      });
    }
  }

  return json(origin, 202, { accepted: samples.length });
});

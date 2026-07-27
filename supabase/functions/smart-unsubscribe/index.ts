// Token-only unsubscribe.
//
// V2 hardening: the previous "raw email" branch used the service-role
// admin API to enumerate users, mint tokens on demand, and echoed
// account state back to any caller. That branch is removed. The
// function now accepts ONLY a pre-issued, one-time unsubscribe token
// (issued server-side and stored in `email_magic_tokens`) and either
// consumes it or renders a generic invalid-link page. No listUsers.
// No raw-email input. No token minting from this endpoint. Generic
// responses only; no sensitive logging.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('smart-unsubscribe');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "X-Content-Type-Options": "nosniff",
};

const getSiteUrl = () => {
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://jojoprompts.com";
  return frontendUrl.replace(/\/+$/, '');
};

// Strict token contract: opaque base62-style, 32–128 chars.
const TOKEN_RE = /^[A-Za-z0-9]{32,128}$/;

const genericInvalidHtml = (status: number) =>
  new Response(
    `<!doctype html><html><body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
      <h2>Invalid or Expired Link</h2>
      <p>This unsubscribe link is invalid or has expired.</p>
      <p><a href="${getSiteUrl()}">Return to JojoPrompts</a></p>
    </body></html>`,
    { status, headers: { ...corsHeaders, "Content-Type": "text/html" } },
  );

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token || !TOKEN_RE.test(token)) {
    return genericInvalidHtml(400);
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Find and validate the pre-issued one-time unsubscribe token.
    const { data: magicTokenData, error: tokenError } = await supabaseClient
      .from("email_magic_tokens")
      .select("id,email")
      .eq("token", token)
      .eq("token_type", "unsubscribe_link")
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (tokenError || !magicTokenData) {
      logger.info('Unsubscribe token rejected'); // no token / email leak
      return genericInvalidHtml(400);
    }

    // Mark token consumed and record the unsubscribe. Failures here
    // are logged generically; caller always sees a generic response.
    await supabaseClient
      .from("email_magic_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", magicTokenData.id);

    await supabaseClient
      .from("unsubscribed_emails")
      .upsert({
        email: magicTokenData.email,
        unsubscribe_type: 'marketing',
        unsubscribed_at: new Date().toISOString(),
      });

    return new Response(
      `<!doctype html><html><body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <div style="max-width: 500px; margin: 0 auto;">
          <h1 style="color: #c49d68;">Successfully Unsubscribed</h1>
          <p>You have been unsubscribed from marketing emails.</p>
          <p>If you change your mind, you can always resubscribe by visiting your account settings.</p>
          <div style="margin: 30px 0;">
            <a href="${getSiteUrl()}" style="display: inline-block; padding: 12px 24px; background: #c49d68; color: white; text-decoration: none; border-radius: 6px;">Return to JojoPrompts</a>
          </div>
        </div>
      </body></html>`,
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } },
    );
  } catch (_err) {
    logger.error('smart-unsubscribe internal error');
    return genericInvalidHtml(400);
  }
};

serve(handler);

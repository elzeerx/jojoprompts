import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { createEdgeLogger } from '../_shared/logger.ts';

const logger = createEdgeLogger('get-image');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

// Image MIME allowlist. JSON, ZIP, MP4, SVG, and arbitrary content are
// rejected. The `prompt-images` bucket contains non-image assets
// (JSON, ZIP, MP4) so this proxy MUST content-type-gate its responses.
const IMAGE_MIME_ALLOWLIST = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
  });
}

/**
 * Path is validated AFTER exactly one URI decode. It must:
 *   - not be empty and not exceed 512 chars
 *   - contain no residual percent-encoded byte (double-encoding guard)
 *   - contain no ".." traversal
 *   - contain no backslash, control char, DEL, or NUL
 *   - not start with "/"
 *   - only contain safe filename characters plus "/" (bucket subdirs)
 */
function isSafeStoragePath(p: string): boolean {
  if (!p || p.length > 512) return false;
  if (/%[0-9a-fA-F]{2}/.test(p)) return false;
  if (p.includes('..')) return false;
  if (/[\\\x00-\x1f\x7f]/.test(p)) return false;
  if (p.startsWith('/')) return false;
  if (!/^[A-Za-z0-9._\-/]+$/.test(p)) return false;
  return true;
}

function clampInt(raw: string | null, def: number, min: number, max: number): number {
  if (raw == null) return def;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  try {
    const url = new URL(req.url);
    const rawPath = url.pathname;
    const idx = rawPath.indexOf('/get-image/');
    if (idx === -1) return notFound();

    const rawSegment = rawPath.substring(idx + '/get-image/'.length);

    // Decode exactly once. Any decoding error → generic 404.
    let imagePath: string;
    try {
      imagePath = decodeURIComponent(rawSegment);
    } catch {
      return notFound();
    }
    if (!isSafeStoragePath(imagePath)) return notFound();

    const width = clampInt(url.searchParams.get('width'), 400, 16, 2048);
    const quality = clampInt(url.searchParams.get('quality'), 80, 10, 100);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    // Authorization: path MUST match a currently published, non-archived
    // resource's hero_image_path. This is the only public compatibility
    // surface — no other paths are exposed.
    const { data: match, error: matchErr } = await supabaseAdmin
      .from('resources')
      .select('id')
      .eq('hero_image_path', imagePath)
      .eq('lifecycle', 'published')
      .is('archived_at', null)
      .limit(1)
      .maybeSingle();

    if (matchErr) {
      logger.warn('resources lookup failed');
      return notFound();
    }
    if (!match) return notFound();

    const { data, error } = await supabaseAdmin
      .storage
      .from('prompt-images')
      .download(imagePath, {
        transform: { width, quality },
      });

    if (error || !data) {
      logger.warn('storage download failed');
      return notFound();
    }

    // MIME allowlist — reject JSON/ZIP/MP4/SVG/etc.
    const contentType = (data.type || '').toLowerCase();
    if (!IMAGE_MIME_ALLOWLIST.has(contentType)) {
      logger.warn('non-image content type rejected');
      return notFound();
    }

    const bytes = await data.arrayBuffer();
    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (_err) {
    logger.error('get-image error');
    return notFound();
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { createEdgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

// Admin publishing validator — not a public API.
// SVG is intentionally excluded because this repo has no trusted SVG
// sanitizer; scripted SVG uploads are a stored-XSS vector.
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;      // 5 MiB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;  // 10 MiB
const MAX_REQUEST_SIZE = MAX_DOCUMENT_SIZE + 64 * 1024; // + form overhead

const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/;
const SUSPICIOUS_EXT = /\.(exe|bat|cmd|scr|vbs|js|jar|php|asp|jsp|sh|ps1)$/i;

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 255);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  const logger = createEdgeLogger('validate-file-upload');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  if (req.method !== "POST") return json(405, { error: 'Method not allowed' });

  // Reject oversized requests BEFORE parsing.
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE) {
    return json(413, { isValid: false, error: 'Request too large' });
  }

  // Auth + can_manage_prompts BEFORE any body parsing / file work.
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { isValid: false, error: 'Unauthorized' });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json(401, { isValid: false, error: 'Unauthorized' });

  const { data: canManage, error: permErr } = await supabase.rpc('can_manage_prompts', {
    _user_id: user.id,
  });
  if (permErr || !canManage) return json(403, { isValid: false, error: 'Forbidden' });

  try {
    const formData = await req.formData();
    const fileField = formData.get('file');
    const fileType = String(formData.get('fileType') ?? '');

    if (!(fileField instanceof File)) {
      return json(400, { isValid: false, error: 'No file provided' });
    }
    const file = fileField;
    if (fileType !== 'image' && fileType !== 'document') {
      return json(400, { isValid: false, error: 'Invalid file type specified' });
    }

    const maxSize = fileType === 'image' ? MAX_IMAGE_SIZE : MAX_DOCUMENT_SIZE;
    if (file.size <= 0 || file.size > maxSize) {
      const label = fileType === 'image' ? '5MB' : '10MB';
      return json(400, { isValid: false, error: `File size exceeds ${label} limit` });
    }

    const mime = (file.type || '').toLowerCase();

    // Explicit SVG rejection — no trusted sanitizer in-repo.
    if (mime === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
      return json(400, { isValid: false, error: 'SVG uploads are not supported' });
    }

    if (SUSPICIOUS_EXT.test(file.name)) {
      return json(400, { isValid: false, error: 'Executable / script extensions are not allowed' });
    }

    const allowed = fileType === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOCUMENT_TYPES;
    if (!allowed.has(mime)) {
      return json(400, { isValid: false, error: `File type ${mime} not allowed for ${fileType} uploads` });
    }

    const sanitizedFilename = sanitizeFilename(file.name);
    if (!SAFE_FILENAME.test(sanitizedFilename)) {
      return json(400, { isValid: false, error: 'Unsafe filename' });
    }

    return json(200, {
      isValid: true,
      sanitizedFilename,
      fileSize: file.size,
      mimeType: mime,
    });
  } catch (_error) {
    logger.error('File validation error');
    return json(500, { isValid: false, error: 'File validation failed' });
  }
});

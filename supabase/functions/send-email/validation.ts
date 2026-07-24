// Pure validation helpers for send-email. Split from index.ts so tests can
// import without pulling in npm:resend, which isn't available in the
// Deno test runner's node_modules resolver.

const MAX_TEMPLATE_SLUG = 80;
const MAX_VARIABLES_JSON = 8_192;
const MAX_VARIABLES_KEYS = 20;

export function validateTemplateSlug(s: unknown): s is string {
  return typeof s === 'string'
    && /^[a-z0-9._-]{1,80}$/.test(s)
    && s.length <= MAX_TEMPLATE_SLUG;
}

export function validateVariables(v: unknown): v is Record<string, unknown> {
  if (v === undefined || v === null) return true as unknown as boolean as any;
  if (typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v as Record<string, unknown>);
  if (keys.length > MAX_VARIABLES_KEYS) return false;
  let json: string;
  try { json = JSON.stringify(v); } catch { return false; }
  if (json.length > MAX_VARIABLES_JSON) return false;
  return true;
}

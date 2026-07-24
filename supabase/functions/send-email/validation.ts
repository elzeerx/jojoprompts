// Pure validation helpers for send-email. Split from index.ts so tests can
// import without pulling in npm:resend, which isn't available in the
// Deno test runner's node_modules resolver.

const MAX_TEMPLATE_SLUG = 80;
const MAX_VARIABLES_JSON = 8_192;
const MAX_VARIABLES_KEYS = 20;
const MAX_VARIABLES_DEPTH = 4;

export function validateTemplateSlug(s: unknown): s is string {
  return typeof s === 'string'
    && /^[a-z0-9._-]{1,80}$/.test(s)
    && s.length <= MAX_TEMPLATE_SLUG;
}

// Depth counts nested object/array levels only; scalars are free.
// `{}` = 1, `{a:{}}` = 2, `{a:{b:{c:{d:1}}}}` = 4.
function withinDepthAndAcyclic(root: unknown, maxDepth: number): boolean {
  const seen = new WeakSet<object>();
  const walk = (node: unknown, depth: number): boolean => {
    if (node === null) return true;
    if (typeof node !== 'object') {
      if (typeof node === 'number' && !Number.isFinite(node)) return false;
      return true;
    }
    if (depth > maxDepth) return false;
    if (seen.has(node as object)) return false; // cycle
    seen.add(node as object);
    if (Array.isArray(node)) {
      for (const item of node) if (!walk(item, depth + 1)) return false;
      return true;
    }
    for (const v of Object.values(node as Record<string, unknown>)) {
      if (!walk(v, depth + 1)) return false;
    }
    return true;
  };
  return walk(root, 1);
}

export function validateVariables(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v as Record<string, unknown>);
  if (keys.length > MAX_VARIABLES_KEYS) return false;
  if (!withinDepthAndAcyclic(v, MAX_VARIABLES_DEPTH)) return false;
  let json: string;
  try { json = JSON.stringify(v); } catch { return false; }
  if (typeof json !== 'string') return false; // e.g. object with toJSON returning undefined
  if (json.length > MAX_VARIABLES_JSON) return false;
  return true;
}

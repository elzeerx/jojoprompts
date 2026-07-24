/**
 * Concise, safe error message for surfacing refundable-order lookup failures.
 * Never leaks stack traces or PII; prefers known Postgres/PostgREST error
 * codes when present. Extracted from CreateRefundDialog so unit tests can
 * import it without pulling in the Supabase browser client.
 */
export function formatRefundableLoadError(err: unknown): string {
  if (!err) return "Failed to load order";
  const e = err as { code?: string; message?: string };
  const code = typeof e.code === "string" && e.code.length <= 12 ? e.code : null;
  const raw = typeof e.message === "string" ? e.message : String(err);
  const msg = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
  return code ? `Failed to load order (${code}): ${msg}` : `Failed to load order: ${msg}`;
}

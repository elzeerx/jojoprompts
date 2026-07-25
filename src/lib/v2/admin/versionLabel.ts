/**
 * Format a resource version label for admin UI display.
 *
 * The stored `version` column already holds the full semantic version
 * (e.g. "1.0.0"). Historically the queue concatenated `major_version`
 * as an extra prefix, which produced "v1.1.0.0" for `major_version=1`
 * and `version="1.0.0"`. Prefer the semantic string when present.
 */
export function formatVersionLabel(
  version: string | null | undefined,
  majorVersion?: number | null,
): string | null {
  const trimmed = typeof version === "string" ? version.trim() : "";
  if (trimmed.length > 0) return `v${trimmed}`;
  if (typeof majorVersion === "number" && Number.isFinite(majorVersion)) {
    return `v${majorVersion}`;
  }
  return null;
}
